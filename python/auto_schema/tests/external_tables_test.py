from pathlib import Path

import pytest
import sqlalchemy as sa

from auto_schema.external_tables import ExternalTables
from auto_schema.runner import Runner


@pytest.mark.parametrize('bad', ['', '*', 'auth*', 'public.auth_*', 'auth.*.x', '.user', 'auth.', ' auth.user', 'auth.user ', '"auth".user', 'auth.user;drop', None, 3])
def test_invalid_ignore_table_grammar(bad):
    with pytest.raises(ValueError, match='expected table'):
        ExternalTables([bad])


def test_exact_default_and_qualified_matching():
    rules = ExternalTables(['user', 'auth.*', 'public.session'])
    rules.default_schema = 'public'
    rules.visible_schemas = {'hidden': 'auth', 'user': 'other'}
    assert rules.matches('user')
    assert not rules.matches('user', 'other')
    assert not rules.matches('user', reflected=True)
    assert rules.matches('hidden', reflected=True)
    assert rules.matches('user', 'auth')
    assert rules.matches('session', 'public')
    assert not rules.matches('auth_user')
    assert not rules.matches('session', 'other')


def managed_metadata(with_change=False):
    metadata = sa.MetaData()
    columns = [sa.Column('id', sa.Integer(), primary_key=True), sa.Column('external_id', sa.String(50))]
    if with_change:
        columns.append(sa.Column('label', sa.Text()))
    sa.Table('accounts', metadata, *columns)
    if with_change:
        sa.Table('managed_new', metadata, sa.Column('id', sa.Integer(), primary_key=True))
    return metadata


def external_snapshot(connection, schema=None):
    inspector = sa.inspect(connection)
    result = {}
    for name in ['identities', 'sessions']:
        table = sa.Table(name, sa.MetaData(), autoload_with=connection, schema=schema)
        result[name] = {
            'columns': [(c['name'], str(c['type']), c['nullable']) for c in inspector.get_columns(name, schema=schema)],
            'indexes': inspector.get_indexes(name, schema=schema),
            'unique': inspector.get_unique_constraints(name, schema=schema),
            'checks': inspector.get_check_constraints(name, schema=schema),
            'fks': inspector.get_foreign_keys(name, schema=schema),
            'rows': list(connection.execute(sa.select(table)).all()),
        }
    return result


def create_external_tables(r, schema=None):
    connection = r.connection
    if schema:
        connection.execute(sa.text(f'CREATE SCHEMA "{schema}"'))
    metadata = sa.MetaData()
    identity = sa.Table('identities', metadata, sa.Column('id', sa.String(50), primary_key=True), schema=schema)
    target = f'{schema}.identities.id' if schema else 'identities.id'
    accounts = sa.Table('accounts', metadata, sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('external_id', sa.String(50)),
        sa.ForeignKeyConstraint(['external_id'], [target], name='accounts_external_fkey'))
    sessions = sa.Table('sessions', metadata, sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('account_id', sa.Integer()), sa.Column('token', sa.Text(), nullable=False),
        sa.UniqueConstraint('token', name='sessions_token_key'),
        sa.CheckConstraint('id > 0', name='sessions_positive'),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], name='sessions_account_fkey'), schema=schema)
    sa.Index('sessions_account_idx', sessions.c.account_id)
    metadata.create_all(connection)
    connection.execute(identity.insert().values(id='external-1'))
    connection.execute(accounts.insert().values(id=1, external_id='external-1'))
    connection.execute(sessions.insert().values(id=1, account_id=1, token='keep-me'))
    connection.commit()


def cascade_runner(new_test_runner, ondelete='CASCADE', onupdate='CASCADE', dev_schema=False):
    metadata = sa.MetaData()
    parents = sa.Table('parents', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                       sa.Column('code', sa.Integer()), sa.Column('label', sa.Text()),
                       sa.UniqueConstraint('code', name='parents_code_key'))
    children = sa.Table('children', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                        sa.Column('code', sa.Integer(), server_default='20'),
                        sa.UniqueConstraint('code', name='children_code_key'),
                        sa.ForeignKeyConstraint(['code'], ['parents.code'], name='children_parent_fkey',
                                                ondelete=ondelete, onupdate=onupdate))
    args = {'ignore_table': ['sessions']}
    if dev_schema:
        args = {'db_schema': 'ent_dev_external_test', 'ignore_table': ['auth.*']}
    r = new_test_runner(metadata, args_override=args)
    if r.connection.dialect.name == 'sqlite':
        r.connection.execute(sa.text('PRAGMA foreign_keys=ON'))
    metadata.create_all(r.connection)
    sessions = 'sessions'
    target = 'children'
    if dev_schema:
        r.connection.execute(sa.text('CREATE SCHEMA auth'))
        sessions = 'auth.sessions'
        target = 'ent_dev_external_test.children'
    r.connection.execute(sa.text(f'CREATE TABLE {sessions} (id INTEGER PRIMARY KEY, code INTEGER REFERENCES {target}(code) ON DELETE CASCADE ON UPDATE CASCADE)'))
    r.connection.execute(parents.insert(), [{'id': 1, 'code': 10, 'label': 'keep'},
                                          {'id': 2, 'code': 20, 'label': 'other'}])
    r.connection.execute(children.insert().values(id=3, code=10))
    r.connection.execute(sa.text(f'INSERT INTO {sessions} VALUES (4, 10)'))
    r.connection.commit()
    return r


def change_parent_seed(r, operation):
    rows = [{'id': 2, 'code': 20, 'label': 'other'}]
    if operation != 'delete':
        rows.append({'id': 1, 'code': 11 if operation == 'update_key' else 10,
                     'label': 'updated' if operation == 'update_label' else 'keep'})
    r.metadata.info['data'] = {'public': {'parents': {'pkeys': ['id'], 'rows': rows}}}


class ExternalTablesTests:
    @pytest.mark.parametrize('qualified', [False, True])
    def test_preserve_external_objects_and_apply_managed_change(self, new_test_runner, qualified):
        default = 'public' if 'Postgres' in type(self).__name__ else 'main'
        patterns = [f'{default}.identities', f'{default}.sessions'] if qualified else ['identities', 'sessions']
        args = {'ignore_table': patterns}
        r = new_test_runner(managed_metadata(True), args_override=args)
        create_external_tables(r)
        before = external_snapshot(r.connection)
        r.connection.commit()
        r.run()
        r.connection.commit()
        assert external_snapshot(r.connection) == before
        assert 'label' in [c['name'] for c in sa.inspect(r.connection).get_columns('accounts')]
        assert sa.inspect(r.connection).has_table('managed_new')
        assert sa.inspect(r.connection).get_foreign_keys('accounts')[0]['name'] == 'accounts_external_fkey'
        assert r.compute_changes() == []
        versions = list(Path(r.schema_path, 'versions').glob('*.py'))
        assert len(versions) == 1
        assert 'sessions' not in versions[0].read_text()
        assert 'identities' not in versions[0].read_text()
        r.run()
        assert list(Path(r.schema_path, 'versions').glob('*.py')) == versions

    @pytest.mark.parametrize('operation', ['drop_table', 'drop_referenced_column', 'drop_referencing_column', 'alter_type'])
    def test_reject_destructive_managed_fk_endpoint_changes(self, new_test_runner, operation):
        args = {'ignore_table': ['identities', 'sessions']}
        metadata = managed_metadata()
        r = new_test_runner(metadata, args_override=args)
        create_external_tables(r)
        before = external_snapshot(r.connection)
        if operation == 'drop_table':
            metadata.remove(metadata.tables['accounts'])
        elif operation == 'drop_referenced_column':
            metadata.tables['accounts']._columns.remove(metadata.tables['accounts'].c.id)
        elif operation == 'drop_referencing_column':
            metadata.tables['accounts']._columns.remove(metadata.tables['accounts'].c.external_id)
        else:
            metadata.tables['accounts'].c.external_id.type = sa.Text()
        with pytest.raises(ValueError, match='ownership boundary'):
            r.run()
        assert external_snapshot(r.connection) == before
        assert not list(Path(r.schema_path, 'versions').glob('*.py'))

    def test_metadata_conflicts_fail_closed(self, new_test_runner):
        r = new_test_runner(managed_metadata())
        with pytest.raises(ValueError, match='matches managed table'):
            new_test_runner(managed_metadata(), r, args_override={'ignore_table': ['accounts']})
        metadata = managed_metadata()
        metadata.tables['accounts'].append_constraint(sa.ForeignKeyConstraint(['external_id'], ['identities.id']))
        with pytest.raises(ValueError, match='external migration instead'):
            new_test_runner(metadata, r, args_override={'ignore_table': ['identities']})

    def test_sql_and_squash_are_deterministic(self, new_test_runner, tmp_path):
        args = {'ignore_table': ['identities', 'sessions']}
        r = new_test_runner(managed_metadata(True), args_override=args)
        create_external_tables(r)
        r.run()
        r.connection.commit()
        before = external_snapshot(r.connection)
        if r.connection.dialect.name == 'postgresql':
            empty = new_test_runner(sa.MetaData(), new_database=True)
            database = empty.connection.engine.url.database
            # Restore the active runner's module configuration.
            r = new_test_runner(managed_metadata(True), r, args_override=args)
        else:
            database = str(tmp_path / 'empty.db')
        output = tmp_path / 'schema.sql'
        r.all_sql(str(output), database=database)
        sql = output.read_text()
        assert 'CREATE TABLE accounts' in sql
        assert 'CREATE TABLE managed_new' in sql
        assert 'sessions' not in sql and 'identities' not in sql
        r.all_sql(str(output), database=database)
        assert output.read_text() == sql
        r.squash_all(database=database)
        revisions = list(Path(r.schema_path, 'versions').glob('*.py'))
        assert len(revisions) == 1
        assert 'sessions' not in revisions[0].read_text()
        assert 'identities' not in revisions[0].read_text()
        assert r.compute_changes() == []
        assert external_snapshot(r.connection) == before

    def test_empty_compare_allows_external_tables_but_rejects_managed_tables(self, new_test_runner, tmp_path):
        args = {'ignore_table': ['sessions']}
        r = new_test_runner(managed_metadata(), args_override=args)
        if r.connection.dialect.name == 'postgresql':
            empty = new_test_runner(sa.MetaData(), new_database=True)
            engine = empty.engine
            database = engine.url.database
            r = new_test_runner(managed_metadata(), r, args_override=args)
        else:
            database = str(tmp_path / 'external-only.db')
            engine = sa.create_engine('sqlite:///' + database)
        try:
            with engine.begin() as conn:
                conn.execute(sa.text('CREATE TABLE sessions (id INTEGER PRIMARY KEY, token TEXT UNIQUE)'))
                conn.execute(sa.text("INSERT INTO sessions VALUES (1, 'preserved')"))
            output = tmp_path / 'external-only.sql'
            r.all_sql(str(output), database=database)
            assert 'CREATE TABLE accounts' in output.read_text()
            assert 'sessions' not in output.read_text()
            with engine.begin() as conn:
                assert conn.scalar(sa.text('SELECT token FROM sessions')) == 'preserved'
                sql = output.read_text()
                if conn.dialect.name == 'sqlite':
                    conn.connection.driver_connection.executescript(sql)
                else:
                    conn.exec_driver_sql(sql)
                assert sa.inspect(conn).has_table('accounts')
                assert conn.scalar(sa.text('SELECT token FROM sessions')) == 'preserved'
            with pytest.raises(Exception, match='cannot have any tables'):
                r.all_sql(str(output), database=database)
        finally:
            if r.connection.dialect.name == 'sqlite':
                engine.dispose()

    def test_seed_data_cannot_delete_externally_referenced_rows(self, new_test_runner):
        r = new_test_runner(managed_metadata(), args_override={'ignore_table': ['identities', 'sessions']})
        create_external_tables(r)
        r.metadata.info['data'] = {'public': {'accounts': {'pkeys': ['id'], 'rows': []}}}
        before = external_snapshot(r.connection)
        with pytest.raises(ValueError, match='ownership boundary'):
            r.run()
        assert external_snapshot(r.connection) == before

    def test_seed_delete_cannot_cascade_through_managed_tables(self, new_test_runner):
        metadata = sa.MetaData()
        parents = sa.Table('parents', metadata, sa.Column('id', sa.Integer(), primary_key=True))
        children = sa.Table('children', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                            sa.Column('parent_id', sa.Integer()),
                            sa.ForeignKeyConstraint(['parent_id'], ['parents.id'],
                                                    name='children_parent_fkey', ondelete='CASCADE'))
        r = new_test_runner(metadata, args_override={'ignore_table': ['sessions']})
        if r.connection.dialect.name == 'sqlite':
            r.connection.execute(sa.text('PRAGMA foreign_keys=ON'))
        metadata.create_all(r.connection)
        r.connection.execute(sa.text('CREATE TABLE sessions (id INTEGER PRIMARY KEY, child_id INTEGER REFERENCES children(id) ON DELETE CASCADE)'))
        r.connection.execute(parents.insert().values(id=1))
        r.connection.execute(children.insert().values(id=2, parent_id=1))
        r.connection.execute(sa.text('INSERT INTO sessions VALUES (3, 2)'))
        r.connection.commit()
        metadata.info['data'] = {'public': {'parents': {'pkeys': ['id'], 'rows': []}}}
        with pytest.raises(ValueError, match='ownership boundary'):
            r.run()
        assert list(r.connection.execute(sa.text('SELECT * FROM sessions'))) == [(3, 2)]
        assert not list(Path(r.schema_path, 'versions').glob('*.py'))

    def test_removing_unrelated_overlapping_unique_index_is_allowed(self, new_test_runner):
        metadata = sa.MetaData()
        sa.Table('accounts', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                 sa.Column('label', sa.Text()))
        r = new_test_runner(metadata, args_override={'ignore_table': ['sessions']})
        metadata.create_all(r.connection)
        r.connection.execute(sa.text('CREATE UNIQUE INDEX accounts_id_label_key ON accounts(id, label)'))
        r.connection.execute(sa.text('CREATE TABLE sessions (id INTEGER PRIMARY KEY, account_id INTEGER REFERENCES accounts(id))'))
        r.connection.execute(sa.text("INSERT INTO accounts VALUES (1, 'keep')"))
        r.connection.execute(sa.text('INSERT INTO sessions VALUES (2, 1)'))
        r.connection.commit()
        r.run()
        r.connection.commit()
        assert r.compute_changes() == []
        assert 'accounts_id_label_key' not in {i['name'] for i in sa.inspect(r.connection).get_indexes('accounts')}
        assert list(r.connection.execute(sa.text('SELECT * FROM sessions'))) == [(2, 1)]

    @pytest.mark.parametrize('operation,ondelete', [('delete', 'CASCADE'), ('update_key', 'CASCADE'),
                                                   ('delete', 'SET NULL'), ('delete', 'SET DEFAULT')])
    def test_seed_changes_cannot_reach_external_rows_indirectly(self, new_test_runner, operation, ondelete):
        r = cascade_runner(new_test_runner, ondelete=ondelete)
        change_parent_seed(r, operation)
        with pytest.raises(ValueError, match='ownership boundary'):
            r.run()
        assert list(r.connection.execute(sa.text('SELECT * FROM sessions'))) == [(4, 10)]
        assert r.connection.scalar(sa.text('SELECT code FROM children')) == 10
        assert not list(Path(r.schema_path, 'versions').glob('*.py'))

    def test_unrelated_seed_updates_remain_managed_with_cascades(self, new_test_runner):
        r = cascade_runner(new_test_runner)
        change_parent_seed(r, 'update_label')
        r.run()
        r.connection.commit()
        assert r.compute_changes() == []
        assert r.connection.scalar(sa.text('SELECT label FROM parents WHERE id = 1')) == 'updated'
        assert list(r.connection.execute(sa.text('SELECT * FROM sessions'))) == [(4, 10)]

    def test_managed_cascade_cycle_without_external_dependents_allows_seed_update(self, new_test_runner):
        metadata = sa.MetaData()
        parents = sa.Table('parents', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                           sa.Column('code', sa.Integer()), sa.UniqueConstraint('code', name='parents_code_key'),
                           sa.ForeignKeyConstraint(['code'], ['parents.code'], name='parents_self_fkey',
                                                   onupdate='CASCADE'))
        r = new_test_runner(metadata, args_override={'ignore_table': ['sessions']})
        metadata.create_all(r.connection)
        r.connection.execute(sa.text('CREATE TABLE sessions (id INTEGER PRIMARY KEY)'))
        r.connection.execute(parents.insert().values(id=1, code=10))
        r.connection.commit()
        metadata.info['data'] = {'public': {'parents': {'pkeys': ['id'], 'rows': [{'id': 1, 'code': 11}]}}}
        r.run()
        r.connection.commit()
        assert r.connection.scalar(sa.text('SELECT code FROM parents')) == 11
        assert r.compute_changes() == []

    @pytest.mark.parametrize('action', ['NO ACTION', 'RESTRICT'])
    def test_non_cascading_managed_dependency_does_not_block_unreferenced_seed_delete(self, new_test_runner, action):
        r = cascade_runner(new_test_runner, ondelete=action)
        # The removed parent has no children; the other parent has external
        # dependents behind a managed FK that cannot propagate a deletion.
        r.connection.execute(sa.text('UPDATE children SET code = 20'))
        r.connection.commit()
        change_parent_seed(r, 'delete')
        r.run()
        r.connection.commit()
        assert r.compute_changes() == []
        assert r.connection.scalar(sa.text('SELECT COUNT(*) FROM parents')) == 1
        assert list(r.connection.execute(sa.text('SELECT * FROM sessions'))) == [(4, 20)]

    def test_ignored_seed_data_is_not_touched(self, new_test_runner):
        r = new_test_runner(managed_metadata(), args_override={'ignore_table': ['identities', 'sessions']})
        create_external_tables(r)
        r.metadata.info['data'] = {'public': {'sessions': {'pkeys': ['id'], 'rows': []}}}
        assert r.compute_changes() == []
        assert r.connection.scalar(sa.text('SELECT token FROM sessions')) == 'keep-me'

    def test_fix_edges_respects_external_ownership(self, new_test_runner):
        r = new_test_runner(sa.MetaData())
        with pytest.raises(ValueError, match='cannot fix_edges'):
            Runner.fix_edges(r.metadata, {'connection': r.connection, 'ignore_table': ['assoc_edge_config']})

    def test_removing_unique_key_used_by_external_fk_is_rejected(self, new_test_runner):
        metadata = sa.MetaData()
        table = sa.Table('accounts', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                         sa.Column('code', sa.String(20)), sa.Column('label', sa.Text()))
        r = new_test_runner(metadata, args_override={'ignore_table': ['sessions']})
        r.connection.execute(sa.text('CREATE TABLE accounts (id INTEGER NOT NULL PRIMARY KEY, code VARCHAR(20), label TEXT)'))
        r.connection.execute(sa.text('CREATE UNIQUE INDEX accounts_code_key ON accounts(code)'))
        r.connection.execute(sa.text('CREATE TABLE sessions (id INTEGER PRIMARY KEY, code VARCHAR(20) REFERENCES accounts(code) ON DELETE CASCADE)'))
        r.connection.execute(sa.text("INSERT INTO accounts VALUES (1, 'a', 'keep')"))
        r.connection.execute(sa.text("INSERT INTO sessions VALUES (1, 'a')"))
        r.connection.commit()
        with pytest.raises(ValueError, match='ownership boundary'):
            r.run()
        # An unrelated index and seed update remain managed.
        sa.Index('accounts_code_key', table.c.code, unique=True)
        sa.Index('accounts_label_idx', table.c.label)
        metadata.info['data'] = {'public': {'accounts': {'pkeys': ['id'], 'rows': [{'id': 1, 'code': 'a', 'label': 'updated'}]}}}
        r.run()
        r.connection.commit()
        assert r.compute_changes() == []
        assert r.connection.scalar(sa.text('SELECT label FROM accounts')) == 'updated'
        assert r.connection.scalar(sa.text('SELECT code FROM sessions')) == 'a'


class TestSQLiteExternalTables(ExternalTablesTests):
    pass


class TestPostgresExternalTables(ExternalTablesTests):
    def test_removing_supporting_composite_unique_constraint_is_rejected(self, new_test_runner):
        metadata = sa.MetaData()
        sa.Table('accounts', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                 sa.Column('code', sa.Integer()), sa.Column('label', sa.Text()))
        r = new_test_runner(metadata, args_override={'ignore_table': ['sessions']})
        metadata.create_all(r.connection)
        r.connection.execute(sa.text('ALTER TABLE accounts ADD CONSTRAINT accounts_code_label_key UNIQUE (code, label)'))
        r.connection.execute(sa.text('CREATE TABLE sessions (id INTEGER PRIMARY KEY, code INTEGER, label TEXT, FOREIGN KEY (code, label) REFERENCES accounts(code, label))'))
        r.connection.commit()
        with pytest.raises(ValueError, match='ownership boundary'):
            r.run()
        assert 'accounts_code_label_key' in {k['name'] for k in sa.inspect(r.connection).get_unique_constraints('accounts')}
        assert not list(Path(r.schema_path, 'versions').glob('*.py'))

    @pytest.mark.parametrize('kind,columns', [('INDEX', 'id'), ('CONSTRAINT', 'id'),
                                             ('CONSTRAINT', 'id, label')])
    def test_remove_unused_unique_key_when_external_fk_uses_primary_key(self, new_test_runner, kind, columns):
        metadata = sa.MetaData()
        sa.Table('accounts', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                 sa.Column('label', sa.Text()))
        r = new_test_runner(metadata, args_override={'ignore_table': ['sessions']})
        metadata.create_all(r.connection)
        r.connection.execute(sa.text('CREATE TABLE sessions (id INTEGER PRIMARY KEY, account_id INTEGER REFERENCES accounts(id))'))
        if kind == 'INDEX':
            r.connection.execute(sa.text(f'CREATE UNIQUE INDEX unused_key ON accounts({columns})'))
        else:
            r.connection.execute(sa.text(f'ALTER TABLE accounts ADD CONSTRAINT unused_key UNIQUE ({columns})'))
        r.connection.execute(sa.text("INSERT INTO accounts VALUES (1, 'keep')"))
        r.connection.execute(sa.text('INSERT INTO sessions VALUES (2, 1)'))
        r.connection.commit()
        r.run()
        r.connection.commit()
        assert r.compute_changes() == []
        assert 'unused_key' not in {i['name'] for i in sa.inspect(r.connection).get_indexes('accounts')}
        assert list(r.connection.execute(sa.text('SELECT * FROM sessions'))) == [(2, 1)]

    @pytest.mark.parametrize('operation,ondelete', [('delete', 'CASCADE'), ('update_key', 'CASCADE'),
                                                   ('delete', 'SET NULL'), ('delete', 'SET DEFAULT')])
    def test_indirect_cascade_into_external_schema_in_dev_mode(self, new_test_runner, operation, ondelete):
        r = cascade_runner(new_test_runner, ondelete=ondelete, dev_schema=True)
        change_parent_seed(r, operation)
        with pytest.raises(ValueError, match='ownership boundary'):
            r.run()
        assert list(r.connection.execute(sa.text('SELECT * FROM auth.sessions'))) == [(4, 10)]
        assert not list(Path(r.schema_path, 'versions').glob('*.py'))

    @pytest.mark.parametrize('patterns', [['auth.*'], ['auth.identities', 'auth.sessions']])
    def test_named_schema_and_search_path(self, new_test_runner, patterns):
        r = new_test_runner(managed_metadata(True), args_override={'ignore_table': patterns})
        create_external_tables(r, schema='auth')
        r.connection.execute(sa.text('CREATE TABLE public.auth_sessions (id integer)'))
        r.connection.execute(sa.text('SET search_path TO public, auth'))
        before = external_snapshot(r.connection, 'auth')
        # Real SQLAlchemy introspection reports these as schema=None when visible.
        assert 'sessions' in sa.inspect(r.connection).get_table_names()
        assert r.connection.dialect.default_schema_name == 'public'
        assert r.connection.scalar(sa.text('SELECT current_schema()')) == 'public'
        r.connection.commit()
        r.run()
        r.connection.commit()
        assert external_snapshot(r.connection, 'auth') == before
        assert not sa.inspect(r.connection).has_table('auth_sessions', schema='public')
        assert r.compute_changes() == []
        assert 'label' in [c['name'] for c in sa.inspect(r.connection).get_columns('accounts')]

    def test_external_enum_is_not_dropped(self, new_test_runner):
        r = new_test_runner(managed_metadata(True), args_override={'ignore_table': ['identities', 'sessions']})
        create_external_tables(r)
        r.connection.execute(sa.text("CREATE TYPE external_status AS ENUM ('ready', 'expired')"))
        r.connection.execute(sa.text("ALTER TABLE sessions ADD COLUMN status external_status DEFAULT 'ready'"))
        r.connection.commit()
        r.run()
        r.connection.commit()
        assert r.connection.scalar(sa.text('SELECT status FROM sessions')) == 'ready'
        assert r.compute_changes() == []

    @pytest.mark.parametrize('include_public', [False, True])
    def test_dev_schema_isolation(self, new_test_runner, include_public):
        r = new_test_runner(sa.MetaData())
        r.connection.execute(sa.text('CREATE TABLE public.accounts (id integer primary key)'))
        r.connection.execute(sa.text('CREATE TABLE public.sessions (id integer primary key)'))
        r.connection.execute(sa.text('INSERT INTO public.sessions VALUES (12)'))
        r.connection.commit()
        args = {'db_schema': 'ent_dev_external_test', 'db_schema_include_public': include_public,
                'ignore_table': ['sessions', 'public.accounts', 'auth.*']}
        r = new_test_runner(managed_metadata(True), r, args_override=args)
        r.connection.execute(sa.text('CREATE TABLE sessions (id integer primary key)'))
        r.connection.execute(sa.text('INSERT INTO sessions VALUES (42)'))
        r.connection.commit()
        r.run()
        r.connection.commit()
        assert 'label' in [c['name'] for c in sa.inspect(r.connection).get_columns('accounts', schema='ent_dev_external_test')]
        assert r.connection.scalar(sa.text('SELECT id FROM public.sessions')) == 12
        assert r.connection.scalar(sa.text('SELECT id FROM ent_dev_external_test.sessions')) == 42
        assert r.compute_changes() == []

    @pytest.mark.parametrize('direction', ['incoming', 'outgoing'])
    def test_dev_schema_guards_cross_schema_fk_dependencies(self, new_test_runner, direction):
        metadata = sa.MetaData()
        table = sa.Table('accounts', metadata, sa.Column('id', sa.String(20), primary_key=True))
        r = new_test_runner(metadata, args_override={
            'db_schema': 'ent_dev_external_test', 'ignore_table': ['auth.*']})
        r.connection.execute(sa.text('CREATE SCHEMA auth'))
        if direction == 'incoming':
            r.connection.execute(sa.text('CREATE TABLE accounts (id VARCHAR(20) PRIMARY KEY)'))
            r.connection.execute(sa.text('CREATE TABLE auth.sessions (id VARCHAR(20) PRIMARY KEY REFERENCES ent_dev_external_test.accounts(id))'))
            r.connection.execute(sa.text("INSERT INTO accounts VALUES ('keep')"))
            r.connection.execute(sa.text("INSERT INTO auth.sessions VALUES ('keep')"))
        else:
            r.connection.execute(sa.text('CREATE TABLE auth.sessions (id VARCHAR(20) PRIMARY KEY)'))
            r.connection.execute(sa.text('CREATE TABLE accounts (id VARCHAR(20) PRIMARY KEY REFERENCES auth.sessions(id))'))
            r.connection.execute(sa.text("INSERT INTO auth.sessions VALUES ('keep')"))
            r.connection.execute(sa.text("INSERT INTO accounts VALUES ('keep')"))
        r.connection.commit()
        table.c.id.type = sa.Text()
        with pytest.raises(ValueError, match='ownership boundary'):
            r.run()
        assert r.connection.scalar(sa.text('SELECT id FROM auth.sessions')) == 'keep'
        assert not list(Path(r.schema_path, 'versions').glob('*.py'))
