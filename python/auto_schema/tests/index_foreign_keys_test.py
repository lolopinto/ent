from pathlib import Path
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from auto_schema.runner import Runner
from .runner_test import _partial_index_metadata, _get_revision_file


class TestPostgresIndexForeignKeys:
    @pytest.mark.parametrize('kind', ['self', 'two', 'cross_schema', 'not_valid'])
    @pytest.mark.parametrize('concurrently', [False, True])
    @pytest.mark.parametrize('scope', ['default', 'dev'])
    def test_unchanged_fk_roundtrip_with_alternate_unique(self, new_test_runner, kind, concurrently, scope):
        args = {'db_schema': 'ent_dev_fk', 'db_schema_include_public': 'false'} if scope == 'dev' else {}

        def metadata(after):
            m = _partial_index_metadata('owner_id > 0' if after else None, unique=True, postgresql_concurrently=concurrently)
            table = m.tables['contacts']
            if kind == 'self':
                table.append_column(sa.Column('parent_owner', sa.Integer()))
            elif kind in ('two', 'not_valid'):
                sa.Table('children', m,
                    sa.Column('id', sa.Integer(), primary_key=True),
                    sa.Column('owner_id', sa.Integer()),
                    sa.Column('mirror_id', sa.Integer()))
            if after:
                table.append_constraint(sa.UniqueConstraint('owner_id', name='contacts_owner_key'))
            return m

        def declared_fks(m):
            if kind == 'self':
                m.tables['contacts'].append_constraint(sa.ForeignKeyConstraint(
                    ['parent_owner'], ['contacts.owner_id'], name='contacts_parent_fk',
                    ondelete='SET NULL', onupdate='CASCADE', deferrable=True, initially='DEFERRED'))
            elif kind in ('two', 'not_valid'):
                for column, name, delete, deferred in [
                    ('owner_id', 'children_owner_fk', 'CASCADE', True),
                    ('mirror_id', 'children_mirror_fk', 'SET NULL', False),
                ]:
                    m.tables['children'].append_constraint(sa.ForeignKeyConstraint(
                        [column], ['contacts.owner_id'], name=name,
                        ondelete=delete, onupdate='CASCADE', deferrable=deferred, match='FULL',
                        postgresql_not_valid=kind == 'not_valid',
                        initially='DEFERRED' if deferred else 'IMMEDIATE'))
            return m

        before = metadata(False)
        r = new_test_runner(before, args_override=args)
        r.run()
        c = r.get_connection()
        declared_fks(before)
        actual_schema = c.execute(sa.text('SELECT current_schema()')).scalar_one()
        if kind == 'cross_schema':
            c.execute(sa.schema.CreateSchema('outside'))
            c.execute(sa.text('CREATE TABLE outside.children (id integer PRIMARY KEY, owner_id integer)'))
            c.execute(sa.text('ALTER TABLE outside.children ADD CONSTRAINT outside_owner_fk '
                f'FOREIGN KEY(owner_id) REFERENCES {actual_schema}.contacts(owner_id) '
                'MATCH FULL ON UPDATE CASCADE ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED'))
        else:
            for table in before.tables.values():
                for constraint in table.foreign_key_constraints:
                    c.execute(sa.schema.AddConstraint(constraint))
        c.execute(before.tables['contacts'].insert(), [{'id': 1, 'owner_id': 10}, {'id': 2, 'owner_id': 20}])
        if kind == 'self':
            c.execute(sa.text('UPDATE contacts SET parent_owner=10 WHERE id=2'))
        elif kind in ('two', 'not_valid'):
            c.execute(sa.text('INSERT INTO children VALUES (1, 10, 20)'))
        else:
            c.execute(sa.text('INSERT INTO outside.children VALUES (1, 10)'))
        if kind == 'not_valid':
            # Existing invalid rows must not be validated as a side effect of
            # rebinding a NOT VALID foreign key. New writes remain enforced.
            c.execute(sa.text('SET session_replication_role=replica'))
            c.execute(sa.text('INSERT INTO children VALUES (2, 999, 999)'))
            c.execute(sa.text('SET session_replication_role=origin'))
        c.commit()

        def foreign_keys():
            return c.execute(sa.text("""
                SELECT n.nspname, t.relname, con.conname, pg_get_constraintdef(con.oid), idx.relname
                FROM pg_constraint con JOIN pg_class t ON t.oid=con.conrelid
                JOIN pg_namespace n ON n.oid=t.relnamespace
                JOIN pg_class idx ON idx.oid=con.conindid
                WHERE con.contype='f' AND con.confrelid='contacts'::regclass
                ORDER BY con.conname
            """)).all()

        initial = foreign_keys()
        assert len(initial) == (2 if kind in ('two', 'not_valid') else 1)
        assert all(row[-1] == 'contacts_active_idx' for row in initial)
        c.commit()
        after = declared_fks(metadata(True))
        r2 = new_test_runner(after, r, args_override=args)
        if kind == 'cross_schema':
            # The referenced child is omitted from the comparison metadata.
            # Fail before generating destructive SQL; do not silently alter an
            # out-of-scope constraint to make the index replacement succeed.
            with pytest.raises(ValueError, match='outside'):
                r2.revision()
            assert foreign_keys() == initial
            assert c.execute(sa.text('SELECT * FROM outside.children')).all() == [(1, 10)]
            assert c.execute(sa.text("SELECT to_regclass('contacts_owner_key')")).scalar_one() is None
            c.commit()
            return
        if concurrently:
            with pytest.raises(ValueError, match='autocommit.*explicit migration'):
                r2.revision()
            assert foreign_keys() == initial
            assert c.execute(sa.text("SELECT to_regclass('contacts_owner_key')")).scalar_one() is None
            c.commit()
            return
        r2.revision()
        assert foreign_keys() == initial
        revision = Path(_get_revision_file(r2)).read_text()
        assert revision.count('drop_constraint(') >= len(initial) * 2
        assert revision.count('create_foreign_key(') == len(initial) * 2

        def assert_state(upgraded):
            rows = foreign_keys()
            assert [tuple(row[:-1]) for row in rows] == [tuple(row[:-1]) for row in initial]
            assert all(row[-1] == ('contacts_owner_key' if upgraded else 'contacts_active_idx') for row in rows)
            assert c.execute(sa.text('SELECT id, owner_id FROM contacts ORDER BY id')).all() == [(1, 10), (2, 20)]
            if kind == 'self':
                assert c.execute(sa.text('SELECT parent_owner FROM contacts WHERE id=2')).scalar_one() == 10
                violation = 'UPDATE contacts SET parent_owner=999 WHERE id=2'
            elif kind in ('two', 'not_valid'):
                expected = [(1, 10, 20)] + ([(2, 999, 999)] if kind == 'not_valid' else [])
                assert c.execute(sa.text('SELECT * FROM children ORDER BY id')).all() == expected
                violation = 'UPDATE children SET owner_id=999 WHERE id=1'
            else:
                assert c.execute(sa.text('SELECT * FROM outside.children')).all() == [(1, 10)]
                violation = 'UPDATE outside.children SET owner_id=999 WHERE id=1'
            with pytest.raises(sa.exc.IntegrityError):
                with c.begin_nested():
                    c.execute(sa.text('SET CONSTRAINTS ALL IMMEDIATE'))
                    c.execute(sa.text(violation))
            c.commit()

        r2.upgrade()
        assert_state(True)
        assert r2.compute_changes() == []
        r2.get_connection().commit()
        r2.downgrade('-1', delete_files=False)
        assert_state(False)
        restored = new_test_runner(before, r2, args_override=args)
        assert restored.compute_changes() == []
        restored.get_connection().commit()
        r2 = new_test_runner(after, restored, args_override=args)
        r2.upgrade()
        assert_state(True)
        assert r2.compute_changes() == []

    @pytest.mark.parametrize('filtered', ['table_name', 'table_object', 'fk_name', 'fk_object', 'comment'])
    def test_excluded_or_unrepresentable_fk_fails_before_revision(self, new_test_runner, filtered):
        before = _metadata_with_child(False)
        r = new_test_runner(before)
        r.run()
        connection = r.get_connection()
        if filtered == 'comment':
            connection.execute(sa.text("COMMENT ON CONSTRAINT children_owner_fk ON children IS 'keep this comment'"))
        connection.execute(before.tables['contacts'].insert(), {'id': 1, 'owner_id': 10})
        connection.execute(before.tables['children'].insert(), {'id': 1, 'owner_id': 10})
        identities_sql = sa.text("""
            SELECT 'contacts_active_idx'::regclass::oid, oid, obj_description(oid, 'pg_constraint')
            FROM pg_constraint WHERE conrelid = 'children'::regclass AND conname = 'children_owner_fk'
        """)
        identities = connection.execute(identities_sql).one()
        connection.commit()
        r2 = new_test_runner(_metadata_with_child(True), r)
        files = set(Path(r2.get_schema_path()).rglob('*.py'))
        include_name, include_object = Runner.include_name, Runner.include_object

        def names(name, type_, parents):
            if filtered == 'table_name' and type_ == 'table' and name == 'children':
                return False
            if filtered == 'fk_name' and type_ == 'foreign_key_constraint' and name == 'children_owner_fk':
                return False
            return include_name(name, type_, parents)

        def objects(object_, name, type_, reflected, compare_to):
            if filtered == 'table_object' and type_ == 'table' and name == 'children':
                return False
            if filtered == 'fk_object' and type_ == 'foreign_key_constraint' and name == 'children_owner_fk':
                return False
            return include_object(object_, name, type_, reflected, compare_to)

        with patch.object(Runner, 'include_name', side_effect=names), patch.object(Runner, 'include_object', side_effect=objects):
            with pytest.raises(ValueError, match='children.children_owner_fk'):
                r2.revision()
        assert connection.execute(identities_sql).one() == identities
        assert connection.execute(sa.text('SELECT * FROM children')).all() == [(1, 10)]
        assert set(Path(r2.get_schema_path()).rglob('*.py')) == files

    @pytest.mark.parametrize('concurrently', [False, True])
    def test_removed_child_retains_normal_table_inverse(self, new_test_runner, concurrently):
        before = _metadata_with_child(False, concurrently=concurrently)
        r = new_test_runner(before)
        r.run()
        after = _partial_index_metadata('owner_id > 0', unique=True, postgresql_concurrently=concurrently)
        r2 = new_test_runner(after, r)
        r2.run()
        assert r2.compute_changes() == []
        r2.downgrade('-1', delete_files=False)
        restored = new_test_runner(before, r2)
        assert restored.compute_changes() == []
        replay = new_test_runner(after, restored)
        replay.upgrade()
        assert replay.compute_changes() == []

    @pytest.mark.parametrize('replacement', ['index', 'options'])
    def test_rebinds_for_alternate_index_or_same_index_options(self, new_test_runner, replacement):
        def metadata(after):
            result = _metadata_with_child(False)
            index = next(iter(result.tables['contacts'].indexes))
            if replacement == 'index' and after:
                index.kwargs['postgresql_where'] = sa.text('owner_id > 0')
                sa.Index('contacts_owner_idx', result.tables['contacts'].c.owner_id, unique=True)
            elif replacement == 'options':
                index.kwargs['postgresql_with'] = {'fillfactor': 80 if after else 70}
            return result

        before = metadata(False)
        r = new_test_runner(before)
        r.run()
        after = metadata(True)
        r2 = new_test_runner(after, r)
        r2.run()
        assert r2.compute_changes() == []
        r2.downgrade('-1', delete_files=False)
        restored = new_test_runner(before, r2)
        assert restored.compute_changes() == []
        replay = new_test_runner(after, restored)
        replay.upgrade()
        assert replay.compute_changes() == []

    def test_fk_bound_to_other_unique_index_keeps_its_identity(self, new_test_runner):
        before = _metadata_with_child(False)
        r = new_test_runner(before)
        r.run()
        connection = r.get_connection()
        connection.execute(sa.text('CREATE UNIQUE INDEX unrelated_idx ON contacts(owner_id)'))
        connection.commit()
        after = _metadata_with_child(False)
        sa.Index('unrelated_idx', after.tables['contacts'].c.owner_id, unique=True,
                 postgresql_where=sa.text('owner_id > 0'), postgresql_concurrently=True)
        fk_sql = sa.text("SELECT oid, conindid FROM pg_constraint WHERE conname='children_owner_fk'")
        before_fk = connection.execute(fk_sql).one()
        connection.commit()
        r2 = new_test_runner(after, r)
        r2.run()
        assert connection.execute(fk_sql).one() == before_fk
        connection.commit()
        assert r2.compute_changes() == []

    def test_delete_column_list_fails_before_revision(self, new_test_runner):
        before = _metadata_with_child(False)
        r = new_test_runner(before)
        r.run()
        connection = r.get_connection()
        if connection.dialect.server_version_info < (15,):
            pytest.skip('ON DELETE SET NULL column lists require PostgreSQL 15')
        connection.execute(sa.text('ALTER TABLE children DROP CONSTRAINT children_owner_fk'))
        connection.execute(sa.text('ALTER TABLE children ADD CONSTRAINT children_owner_fk '
            'FOREIGN KEY(owner_id) REFERENCES contacts(owner_id) ON DELETE SET NULL (owner_id)'))
        definition = sa.text("SELECT oid, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='children_owner_fk'")
        original = connection.execute(definition).one()
        connection.commit()
        after = _metadata_with_child(True)
        next(iter(after.tables['children'].foreign_key_constraints)).ondelete = 'SET NULL (owner_id)'
        r2 = new_test_runner(after, r)
        with pytest.raises(ValueError, match='attributes requiring an explicit migration'):
            r2.revision()
        assert connection.execute(definition).one() == original

    def test_enum_commit_before_rebinding_remains_supported(self, new_test_runner):
        from sqlalchemy.dialects import postgresql

        def metadata(after):
            result = _metadata_with_child(False)
            next(iter(result.tables['contacts'].indexes)).kwargs['postgresql_with'] = {'fillfactor': 80 if after else 70}
            labels = ['active', 'archived'] if after else ['active']
            sa.Table('other', result, sa.Column('id', sa.Integer(), primary_key=True),
                     sa.Column('state', postgresql.ENUM(*labels, name='other_state', create_type=False)))
            return result

        r = new_test_runner(metadata(False))
        r.run()
        r2 = new_test_runner(metadata(True), r)
        r2.run()
        assert r2.compute_changes() == []
        r2.get_connection().commit()
        state = _cascade_state(r2.engine)
        # Enum-label commits precede removal in upgrade. The irreversible
        # downgrade guard also runs before FK or index changes.
        with pytest.raises(ValueError, match='not reversible'):
            r2.downgrade('-1', delete_files=False)
        assert _cascade_state(r2.engine) == state

    def test_deliberate_fk_removal_with_concurrent_index_remains_reversible(self, new_test_runner):
        def metadata(after):
            result = _metadata_with_child(False, concurrently=True)
            next(iter(result.tables['contacts'].indexes)).kwargs['postgresql_with'] = {'fillfactor': 80 if after else 70}
            if after:
                child = result.tables['children']
                child.constraints.remove(next(iter(child.foreign_key_constraints)))
            return result

        before = metadata(False)
        r = new_test_runner(before)
        r.run()
        r2 = new_test_runner(metadata(True), r)
        r2.run()
        assert r2.compute_changes() == []
        assert sa.inspect(r2.engine).get_foreign_keys('children') == []
        r2.downgrade('-1', delete_files=False)
        restored = new_test_runner(before, r2)
        assert restored.compute_changes() == []
        assert [fk['name'] for fk in sa.inspect(restored.engine).get_foreign_keys('children')] == ['children_owner_fk']
        replay = new_test_runner(metadata(True), restored)
        replay.upgrade()
        assert replay.compute_changes() == []

    @pytest.mark.parametrize('full_text', [False, True])
    @pytest.mark.parametrize('rename', [False, True])
    def test_requested_fk_replacement_cannot_cross_unrelated_index_commit(self, new_test_runner, full_text, rename):
        from auto_schema.schema_item import FullTextIndex

        def metadata(after):
            result = _metadata_with_child(False)
            constraint = next(iter(result.tables['children'].foreign_key_constraints))
            constraint.ondelete = 'CASCADE'
            if after:
                constraint.onupdate = 'CASCADE'
                if rename:
                    constraint.name = 'children_replaced_fk'
            table = sa.Table('a_other', result, sa.Column('id', sa.Integer(), primary_key=True), sa.Column('label', sa.Text()))
            if full_text:
                table.append_constraint(FullTextIndex('other_idx', info={
                    'columns': ['label'], 'postgresql_using': 'gin',
                    'postgresql_using_internals': "to_tsvector('english', label)",
                    'postgresql_where': 'label IS NULL' if after else 'label IS NOT NULL',
                    'postgresql_concurrently': True,
                }))
            else:
                sa.Index('other_idx', table.c.label, postgresql_concurrently=True,
                         postgresql_with={'fillfactor': 80 if after else 70})
            return result

        r = new_test_runner(metadata(False))
        r.run()
        connection = r.get_connection()
        connection.execute(sa.text('INSERT INTO contacts(id, owner_id) VALUES (1, 10)'))
        connection.execute(sa.text('INSERT INTO children(id, owner_id) VALUES (1, 10)'))
        connection.commit()
        before = _cascade_state(r.engine)
        other_index = connection.execute(sa.text("SELECT 'other_idx'::regclass::oid")).scalar_one()
        connection.commit()
        r2 = new_test_runner(metadata(True), r)
        files = set(Path(r2.get_schema_path()).rglob('*.py'))
        with pytest.raises(ValueError, match='foreign keys.*autocommit.*explicit migration'):
            r2.revision()
        assert _cascade_state(r.engine) == before
        assert set(Path(r2.get_schema_path()).rglob('*.py')) == files
        with r.engine.begin() as writer:
            assert writer.execute(sa.text("SELECT 'other_idx'::regclass::oid")).scalar_one() == other_index
            writer.execute(sa.text('DELETE FROM contacts WHERE id=1'))
            assert writer.execute(sa.text('SELECT count(*) FROM children')).scalar_one() == 0

    @pytest.mark.parametrize('table_name,trigger_type', [('contacts', 9), ('children', 5)])
    @pytest.mark.parametrize('mode', ['A', 'R', 'D'])
    def test_custom_fk_trigger_mode_requires_explicit_migration(self, new_test_runner, table_name, trigger_type, mode):
        def metadata(after):
            result = _metadata_with_child(False)
            next(iter(result.tables['contacts'].indexes)).kwargs['postgresql_with'] = {'fillfactor': 80 if after else 70}
            next(iter(result.tables['children'].foreign_key_constraints)).ondelete = 'CASCADE'
            return result

        r = new_test_runner(metadata(False))
        r.run()
        connection = r.get_connection()
        triggers_sql = sa.text("""
            SELECT oid, tgrelid, tgname, tgtype, tgenabled FROM pg_trigger
            WHERE tgconstraint = (SELECT oid FROM pg_constraint
                WHERE conrelid = 'children'::regclass AND conname = 'children_owner_fk')
            ORDER BY oid
        """)
        table_oid = connection.execute(sa.text('SELECT CAST(:name AS regclass)::oid'), {'name': table_name}).scalar_one()
        trigger = next(row for row in connection.execute(triggers_sql) if row.tgrelid == table_oid and row.tgtype == trigger_type)
        action = {'A': 'ENABLE ALWAYS', 'R': 'ENABLE REPLICA', 'D': 'DISABLE'}[mode]
        trigger_name = connection.dialect.identifier_preparer.quote(trigger.tgname)
        connection.exec_driver_sql(f'ALTER TABLE {table_name} {action} TRIGGER {trigger_name}')
        connection.execute(sa.text('INSERT INTO contacts(id, owner_id) VALUES (1, 10)'))
        connection.execute(sa.text('INSERT INTO children(id, owner_id) VALUES (1, 10)'))
        original_triggers = connection.execute(triggers_sql).all()
        connection.commit()
        original_state = _cascade_state(r.engine)
        r2 = new_test_runner(metadata(True), r)
        files = set(Path(r2.get_schema_path()).rglob('*.py'))
        with pytest.raises(ValueError, match='trigger modes.*explicit migration'):
            r2.revision()
        assert set(Path(r2.get_schema_path()).rglob('*.py')) == files
        assert _cascade_state(r.engine) == original_state
        with r.engine.connect() as writer:
            assert writer.execute(triggers_sql).all() == original_triggers
            if mode in ('A', 'R'):
                writer.exec_driver_sql('SET LOCAL session_replication_role=replica')
            if table_name == 'contacts':
                writer.execute(sa.text('DELETE FROM contacts WHERE id=1'))
                assert writer.execute(sa.text('SELECT count(*) FROM children')).scalar_one() == (1 if mode == 'D' else 0)
            elif mode == 'D':
                writer.execute(sa.text('INSERT INTO children VALUES (2, 999)'))
            else:
                with pytest.raises(sa.exc.IntegrityError):
                    with writer.begin_nested():
                        writer.execute(sa.text('INSERT INTO children VALUES (2, 999)'))
            writer.rollback()

    @pytest.mark.parametrize('barrier', ['supporting', 'other_create', 'other_drop', 'full_text_create', 'full_text_drop'])
    def test_concurrent_rebinding_rejected_without_losing_cascade(self, new_test_runner, barrier):
        from auto_schema.schema_item import FullTextIndex

        def metadata(after):
            result = _metadata_with_child(False)
            index = next(iter(result.tables['contacts'].indexes))
            index.kwargs['postgresql_with'] = {'fillfactor': 80 if after else 70}
            index.kwargs['postgresql_concurrently'] = barrier == 'supporting'
            next(iter(result.tables['children'].foreign_key_constraints)).ondelete = 'CASCADE'
            other = sa.Table('unrelated', result, sa.Column('id', sa.Integer(), primary_key=True), sa.Column('label', sa.Text()))
            if barrier != 'supporting' and after == barrier.endswith('create'):
                if barrier.startswith('full_text'):
                    other.append_constraint(FullTextIndex('unrelated_idx', info={
                        'columns': ['label'], 'postgresql_using': 'gin',
                        'postgresql_using_internals': "to_tsvector('english', label)",
                        'postgresql_concurrently': True,
                    }))
                else:
                    sa.Index('unrelated_idx', other.c.label, postgresql_concurrently=True)
            return result

        r = new_test_runner(metadata(False))
        r.run()
        connection = r.get_connection()
        connection.execute(sa.text('INSERT INTO contacts(id, owner_id) VALUES (1, 10)'))
        connection.execute(sa.text('INSERT INTO children(id, owner_id) VALUES (1, 10)'))
        connection.commit()
        before = _cascade_state(r.engine)
        r2 = new_test_runner(metadata(True), r)
        files = set(Path(r2.get_schema_path()).rglob('*.py'))
        # PostgreSQL does not reflect CONCURRENTLY, so model a drop request via
        # the collected operation. This also covers the concurrent CREATE that
        # reversing that drop emits during downgrade.
        if barrier.endswith('drop'):
            from auto_schema import postgresql_dependencies
            collect = postgresql_dependencies.collect_index_foreign_keys

            def concurrent_drop(context, upgrade, schemas):
                for table_ops in upgrade.ops:
                    for operation in getattr(table_ops, 'ops', []):
                        if getattr(operation, 'index_name', None) == 'unrelated_idx':
                            options = operation.kw.setdefault('info', {}) if barrier.startswith('full_text') else operation.kw
                            options['postgresql_concurrently'] = True
                return collect(context, upgrade, schemas)

            with patch.object(postgresql_dependencies, 'collect_index_foreign_keys', side_effect=concurrent_drop):
                with pytest.raises(ValueError, match='autocommit.*explicit migration'):
                    r2.revision()
        else:
            with pytest.raises(ValueError, match='autocommit.*explicit migration'):
                r2.revision()
        assert _cascade_state(r.engine) == before
        assert set(Path(r2.get_schema_path()).rglob('*.py')) == files
        # A normal write on another connection still sees the unchanged CASCADE.
        with r.engine.begin() as writer:
            writer.execute(sa.text('DELETE FROM contacts WHERE id=1'))
            assert writer.execute(sa.text('SELECT count(*) FROM children')).scalar_one() == 0


def _cascade_state(engine):
    with engine.connect() as connection:
        return (
            connection.execute(sa.text("SELECT indexrelid, pg_get_indexdef(indexrelid), indisvalid FROM pg_index WHERE indexrelid='contacts_active_idx'::regclass")).one(),
            connection.execute(sa.text("SELECT oid, conindid, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='children_owner_fk'")).one(),
            connection.execute(sa.text('SELECT version_num FROM alembic_version')).scalar_one(),
            connection.execute(sa.text('SELECT id, owner_id FROM contacts ORDER BY id')).all(),
            connection.execute(sa.text('SELECT * FROM children ORDER BY id')).all(),
        )


def _metadata_with_child(after, *, concurrently=False):
    result = _partial_index_metadata('owner_id > 0' if after else None, unique=True, postgresql_concurrently=concurrently)
    if after:
        result.tables['contacts'].append_constraint(sa.UniqueConstraint('owner_id', name='contacts_owner_key'))
    sa.Table('children', result,
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('owner_id', sa.Integer()),
        sa.ForeignKeyConstraint(['owner_id'], ['contacts.owner_id'], name='children_owner_fk'))
    return result
