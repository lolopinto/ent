from pathlib import Path
import uuid

import pytest
import sqlalchemy as sa
from alembic.autogenerate.api import AutogenContext
from alembic.operations import ops

from auto_schema.external_tables import ExternalTables
from auto_schema.ops import RemoveRowsOp
from tests.external_tables_test import cascade_runner, change_parent_seed


def edge_runner(new_test_runner, metadata, reference='edge_type', dev_schema=False):
    edges = metadata.info['edges']['public']
    edge = edges['UserToFollowersEdge']
    # Timestamps are equal for edges inserted together, so that key case only
    # needs one edge. Deletion cases deliberately keep a second edge/table alive.
    if reference != 'updated_at':
        edges['OtherEdge'] = dict(edge, edge_name='OtherEdge', edge_table='other_edges',
                                  edge_type=uuid.uuid4() if isinstance(edge['edge_type'], uuid.UUID) else 2)
        if reference == 'symmetric_edge':
            edges['OtherEdge']['symmetric_edge'] = True
    table = metadata.tables['assoc_edge_config']
    if reference != 'edge_type':
        sa.Index('edge_reference_key', table.c[reference], unique=True)
    args = {'ignore_table': ['edge_preferences']}
    if dev_schema:
        args = {'db_schema': 'ent_dev_external_mutations', 'ignore_table': ['auth.*']}
    r = new_test_runner(metadata, args_override=args)
    r.run()
    r.connection.commit()
    external = 'edge_preferences'
    target = 'assoc_edge_config'
    if dev_schema:
        r.connection.execute(sa.text('CREATE SCHEMA auth'))
        external = 'auth.edge_preferences'
        target = 'ent_dev_external_mutations.assoc_edge_config'
    column_type = table.c[reference].type.compile(dialect=r.connection.dialect)
    r.connection.execute(sa.text(f'CREATE TABLE {external} (id INTEGER PRIMARY KEY, value {column_type} REFERENCES {target}({reference}) ON DELETE CASCADE ON UPDATE CASCADE)'))
    r.connection.execute(sa.text(f"INSERT INTO {external} SELECT 1, {reference} FROM {target} WHERE edge_name = 'UserToFollowersEdge'"))
    r.connection.commit()
    return r, external


def assert_rejected_without_changes(r, external):
    before = list(r.connection.execute(sa.text(f'SELECT * FROM {external}')))
    revisions = list(Path(r.schema_path, 'versions').glob('*.py'))
    with pytest.raises(ValueError, match='ownership boundary'):
        r.compute_changes()
    assert list(r.connection.execute(sa.text(f'SELECT * FROM {external}'))) == before
    assert list(Path(r.schema_path, 'versions').glob('*.py')) == revisions


class ExternalEdgeMutationTests:
    @pytest.mark.parametrize('operation,reference', [('delete', 'edge_type'), ('update', 'edge_table'),
                                                    ('update', 'updated_at')])
    def test_edge_mutations_protect_external_rows(self, new_test_runner, metadata_with_one_edge, operation, reference):
        r, external = edge_runner(new_test_runner, metadata_with_one_edge, reference)
        edges = r.metadata.info['edges']['public']
        if operation == 'delete':
            del edges['UserToFollowersEdge']
        else:
            edges['UserToFollowersEdge']['edge_table'] = 'renamed_edges'
        assert_rejected_without_changes(r, external)

    @pytest.mark.parametrize('reference', ['edge_type', 'symmetric_edge'])
    def test_unrelated_edge_update_remains_managed(self, new_test_runner, metadata_with_one_edge, reference):
        r, external = edge_runner(new_test_runner, metadata_with_one_edge, reference)
        before = list(r.connection.execute(sa.text(f'SELECT * FROM {external}')))
        r.metadata.info['edges']['public']['UserToFollowersEdge']['edge_table'] = 'renamed_edges'
        r.run()
        r.connection.commit()
        assert r.compute_changes() == []
        assert r.connection.scalar(sa.text("SELECT edge_table FROM assoc_edge_config WHERE edge_name = 'UserToFollowersEdge'")) == 'renamed_edges'
        assert list(r.connection.execute(sa.text(f'SELECT * FROM {external}'))) == before


class TestSQLiteExternalEdgeMutations(ExternalEdgeMutationTests):
    def test_table_drop_cannot_cascade_before_managed_fk_removal(self, new_test_runner):
        r = cascade_runner(new_test_runner)
        # SQLite DROP TABLE implicitly deletes its rows, including cascades.
        with r.connection.begin_nested() as savepoint:
            r.connection.execute(sa.text('DROP TABLE parents'))
            assert r.connection.scalar(sa.text('SELECT COUNT(*) FROM sessions')) == 0
            savepoint.rollback()
        metadata = sa.MetaData()
        sa.Table('children', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                 sa.Column('code', sa.Integer(), server_default='20'),
                 sa.UniqueConstraint('code', name='children_code_key'))
        r = new_test_runner(metadata, r, args_override={'ignore_table': ['sessions']})
        assert_rejected_without_changes(r, 'sessions')


class TestPostgresExternalEdgeMutations(ExternalEdgeMutationTests):
    def test_pending_cascade_change_also_protects_edge_removal(self, new_test_runner, metadata_with_one_edge):
        metadata = metadata_with_one_edge
        edges = metadata.info['edges']['public']
        edges['OtherEdge'] = dict(edges['UserToFollowersEdge'], edge_name='OtherEdge', edge_type=uuid.uuid4())
        links = sa.Table('edge_links', metadata, sa.Column('id', sa.Integer(), primary_key=True),
                         sa.Column('edge_type', sa.UUID()),
                         sa.ForeignKeyConstraint(['edge_type'], ['assoc_edge_config.edge_type'],
                                                 name='edge_links_config_fkey', ondelete='NO ACTION'))
        r = new_test_runner(metadata, args_override={'ignore_table': ['edge_preferences']})
        r.run()
        r.connection.commit()
        r.connection.execute(links.insert().values(id=1, edge_type=edges['UserToFollowersEdge']['edge_type']))
        r.connection.execute(sa.text('CREATE TABLE edge_preferences (id INTEGER PRIMARY KEY, link_id INTEGER REFERENCES edge_links(id) ON DELETE CASCADE)'))
        r.connection.execute(sa.text('INSERT INTO edge_preferences VALUES (2, 1)'))
        r.connection.commit()
        next(iter(links.foreign_key_constraints)).ondelete = 'CASCADE'
        del edges['UserToFollowersEdge']
        assert_rejected_without_changes(r, 'edge_preferences')

    @pytest.mark.parametrize('operation,reference', [('delete', 'edge_type'), ('update', 'edge_table')])
    def test_dev_schema_edge_mutations_protect_external_rows(self, new_test_runner, metadata_with_one_edge, operation, reference):
        r, external = edge_runner(new_test_runner, metadata_with_one_edge, reference, dev_schema=True)
        edges = r.metadata.info['edges']['public']
        if operation == 'delete':
            del edges['UserToFollowersEdge']
        else:
            edges['UserToFollowersEdge']['edge_table'] = 'renamed_edges'
        assert_rejected_without_changes(r, external)


class TestPostgresExternalMutations:
    @pytest.mark.parametrize('change', ['replace', 'add'])
    @pytest.mark.parametrize('operation,action', [('delete', 'CASCADE'), ('delete', 'SET NULL'),
                                                ('update_key', 'CASCADE')])
    def test_pending_cascade_change_protects_external_rows(self, new_test_runner, change, operation, action):
        r = cascade_runner(new_test_runner, ondelete='NO ACTION', onupdate='NO ACTION')
        if change == 'add':
            r.connection.execute(sa.text('ALTER TABLE children DROP CONSTRAINT children_parent_fkey'))
            r.connection.commit()
        fk = next(iter(r.metadata.tables['children'].foreign_key_constraints))
        if operation == 'delete':
            fk.ondelete = action
        else:
            fk.onupdate = action
        change_parent_seed(r, operation)
        assert_rejected_without_changes(r, 'sessions')
        assert not list(Path(r.schema_path, 'versions').glob('*.py'))

    @pytest.mark.parametrize('change', ['replace', 'remove'])
    def test_removing_cascade_before_seed_delete_allows_safe_change(self, new_test_runner, change):
        r = cascade_runner(new_test_runner)
        r.connection.execute(sa.text('UPDATE children SET code = 20'))
        r.connection.commit()
        children = r.metadata.tables['children']
        fk = next(iter(children.foreign_key_constraints))
        if change == 'replace':
            fk.ondelete = 'NO ACTION'
        else:
            children.constraints.remove(fk)
        change_parent_seed(r, 'delete')
        diff = r.compute_changes()
        # Reflection/seed reads use one connection, migration DDL uses another.
        r.connection.commit()
        r._apply_changes(diff)
        r.connection.commit()
        assert r.compute_changes() == []
        assert list(r.connection.execute(sa.text('SELECT * FROM sessions'))) == [(4, 20)]
        assert r.connection.scalar(sa.text('SELECT COUNT(*) FROM parents')) == 1

    def test_later_fk_removal_cannot_justify_earlier_seed_delete(self, new_test_runner):
        r = cascade_runner(new_test_runner)
        fk = next(iter(r.metadata.tables['children'].foreign_key_constraints))
        planned = ops.UpgradeOps([
            RemoveRowsOp('parents', ['id'], [{'id': 1}]),
            ops.ModifyTableOps('children', [ops.DropConstraintOp.from_constraint(fk)]),
        ])
        rules = ExternalTables(['sessions'])
        rules.configure(r.connection)
        with pytest.raises(ValueError, match='ownership boundary'):
            rules.guard_dependencies(AutogenContext(r._migration_context()), planned)

    def test_pending_cascade_into_external_schema_in_dev_mode(self, new_test_runner):
        r = cascade_runner(new_test_runner, ondelete='NO ACTION', dev_schema=True)
        fk = next(iter(r.metadata.tables['children'].foreign_key_constraints))
        fk.ondelete = 'CASCADE'
        change_parent_seed(r, 'delete')
        assert_rejected_without_changes(r, 'auth.sessions')
