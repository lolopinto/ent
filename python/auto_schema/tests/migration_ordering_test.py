import alembic.operations.ops as alembicops
import pytest
import sqlalchemy as sa

from auto_schema import migration_ordering, ops


def _index_changes(*, concurrently=True):
    table = sa.Table(
        "parent", sa.MetaData(),
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("score", sa.Date()), schema="tenant",
    )
    old_index = sa.Index("parent_idx", table.c.id, unique=True, postgresql_concurrently=concurrently)
    new_index = sa.Index("parent_idx", table.c.id, unique=True, postgresql_where=sa.text("id > 0"))
    return alembicops.ModifyTableOps("parent", [
        alembicops.AlterColumnOp(
            "parent", "score", schema="tenant", existing_type=sa.Date(), modify_type=sa.TIMESTAMP(),
        ),
        alembicops.DropIndexOp.from_index(old_index),
        alembicops.CreateIndexOp.from_index(new_index),
    ], schema="tenant")


def _flatten(container):
    return [
        child
        for operation in container.ops
        for child in (operation.ops if isinstance(operation, alembicops.ModifyTableOps) else [operation])
    ]


@pytest.mark.parametrize("child_first", [False, True])
@pytest.mark.parametrize("concurrently", [False, True])
def test_cross_table_dependencies_reverse_with_type_changes(child_first, concurrently):
    old_fk = alembicops.CreateForeignKeyOp(
        "old_fk", "child", "parent", ["owner_id"], ["id"],
        source_schema="tenant", referent_schema="tenant", ondelete="CASCADE",
    )
    new_fk = alembicops.CreateForeignKeyOp(
        "new_fk", "child", "other_parent", ["owner_id"], ["id"],
        source_schema="tenant", referent_schema="tenant", deferrable=True,
    )
    parent = _index_changes(concurrently=concurrently)
    child = alembicops.ModifyTableOps("child", [old_fk.reverse(), new_fk], schema="tenant")
    upgrade = alembicops.UpgradeOps([child, parent] if child_first else [parent, child])
    # Data comparison can run before another schema comparator appends table DDL.
    removed_rows = ops.RemoveRowsOp("parent", ["id"], [{"id": 1}])
    upgrade.ops.insert(1, removed_rows)
    if concurrently:
        with pytest.raises(ValueError, match='foreign keys.*autocommit.*explicit migration'):
            migration_ordering.order_upgrade(upgrade, dialect_name="postgresql")
        return
    migration_ordering.order_upgrade(upgrade, dialect_name="postgresql")
    expected = [
        alembicops.DropConstraintOp, alembicops.DropIndexOp, alembicops.AlterColumnOp,
        alembicops.CreateIndexOp, alembicops.CreateForeignKeyOp,
    ]
    assert [type(op) for op in _flatten(upgrade)] == expected + [ops.RemoveRowsOp]
    assert all(op.schema == "tenant" for op in upgrade.ops[:-1])
    downgrade = upgrade.reverse()
    migration_ordering.order_downgrade(downgrade)
    assert [type(op) for op in _flatten(downgrade)] == [ops.AddRowsOp] + expected
    assert all(op.schema == "tenant" for op in downgrade.ops[1:])
    restored_fk = _flatten(downgrade)[-1]
    assert restored_fk.constraint_name == "old_fk"
    assert restored_fk.referent_table == "parent"
    assert restored_fk.kw["ondelete"] == "CASCADE"


def test_setup_and_irreversibility_precede_index_sql():
    table = _index_changes()
    enum = ops.AddEnumOp("other_enum", ["a", "b"])
    first = ops.AlterEnumOp("status", "archived", before="deleted")
    second = ops.AlterEnumOp("status", "deleted")
    move = ops.SetExtensionSchemaOp("pg_trgm", "public", "extensions")
    upgrade = alembicops.UpgradeOps([table, enum, first, move, second])
    migration_ordering.order_upgrade(upgrade, dialect_name="postgresql")
    assert upgrade.ops == [move, enum, first, second, table]
    downgrade = upgrade.reverse()
    migration_ordering.order_downgrade(downgrade)
    assert [type(op) for op in downgrade.ops[:3]] == [
        ops.NoDowngradeOp, ops.NoDowngradeOp, ops.SetExtensionSchemaOp,
    ]
    assert isinstance(downgrade.ops[3], alembicops.ModifyTableOps)
    assert isinstance(downgrade.ops[-1], ops.DropEnumOp)
    # Repeated lifecycle adapters must not alter a completed sequence.
    ordered = list(downgrade.ops)
    migration_ordering.order_downgrade(downgrade)
    assert downgrade.ops == ordered


@pytest.mark.parametrize("dialect_name", ["postgresql", "sqlite"])
def test_edge_cleanup_precedes_table_drop_while_seed_changes_follow_fks(dialect_name):
    edge_table = sa.Table("assoc_edge_config", sa.MetaData(), sa.Column("edge_name", sa.Text()))
    drop = alembicops.DropTableOp.from_table(edge_table)
    remove_edges = ops.RemoveEdgesOp([])
    remove_rows = ops.RemoveRowsOp("parent", ["id"], [{"id": 1}])
    fk = alembicops.CreateForeignKeyOp("fk", "child", "parent", ["owner_id"], ["id"])
    child = alembicops.ModifyTableOps("child", [fk])
    upgrade = alembicops.UpgradeOps([drop, remove_edges, _index_changes(), child, remove_rows])
    migration_ordering.order_upgrade(upgrade, dialect_name=dialect_name)
    flattened = _flatten(upgrade)
    assert flattened.index(remove_edges) < flattened.index(drop)
    assert flattened.index(fk) < flattened.index(remove_rows)
    downgrade = upgrade.reverse()
    migration_ordering.order_downgrade(downgrade)
    reversed_types = [type(op) for op in _flatten(downgrade)]
    assert reversed_types.index(alembicops.CreateTableOp) < reversed_types.index(ops.AddEdgesOp)
    assert reversed_types.index(ops.AddRowsOp) < reversed_types.index(alembicops.DropConstraintOp)


@pytest.mark.parametrize("constraint_name", [None, "child_parent_fk"])
def test_new_table_fk_is_reversible_without_losing_table_options(constraint_name):
    metadata = sa.MetaData(schema="tenant")
    sa.Table("parent", metadata, sa.Column("id", sa.Integer(), primary_key=True))
    child = sa.Table(
        "child", metadata,
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("owner_id", sa.Integer()),
        sa.UniqueConstraint("owner_id", name="child_unique"),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["tenant.parent.id"], name=constraint_name,
            ondelete="CASCADE", deferrable=True, initially="DEFERRED",
        ),
        comment="child table",
    )
    create = alembicops.CreateTableOp.from_table(child)
    upgrade = alembicops.UpgradeOps([create, _index_changes()])
    migration_ordering.order_upgrade(upgrade, dialect_name="postgresql")
    deferred = _flatten(upgrade)[-1]
    assert isinstance(deferred, alembicops.CreateForeignKeyOp)
    assert deferred.constraint_name
    if constraint_name:
        assert deferred.constraint_name == constraint_name
    assert deferred.kw == {
        "source_schema": "tenant", "referent_schema": "tenant",
        "ondelete": "CASCADE", "deferrable": True, "initially": "DEFERRED",
    }
    restored = create.to_table()
    assert restored.comment == "child table"
    assert not restored.foreign_key_constraints
    assert any(constraint.name == "child_unique" for constraint in restored.constraints)
    assert next(iter(child.foreign_key_constraints)).name == constraint_name
    downgrade = upgrade.reverse()
    migration_ordering.order_downgrade(downgrade)
    assert isinstance(_flatten(downgrade)[0], alembicops.DropConstraintOp)
    assert _flatten(downgrade)[0].constraint_name == deferred.constraint_name
    assert isinstance(_flatten(downgrade)[-1], alembicops.DropTableOp)
    ordered = _flatten(upgrade)
    migration_ordering.order_upgrade(upgrade, dialect_name="postgresql")
    assert _flatten(upgrade) == ordered


@pytest.mark.parametrize("dialect_name,drop_index", [("postgresql", False), ("sqlite", True)])
def test_foreign_keys_remain_in_place_without_postgres_index_drops(dialect_name, drop_index):
    fk = alembicops.CreateForeignKeyOp("fk", "child", "parent", ["owner_id"], ["id"])
    child = alembicops.ModifyTableOps("child", [fk])
    parent = _index_changes()
    if not drop_index:
        parent.ops = [op for op in parent.ops if not isinstance(op, alembicops.DropIndexOp)]
    upgrade = alembicops.UpgradeOps([child, parent])
    migration_ordering.order_upgrade(upgrade, dialect_name=dialect_name)
    assert upgrade.ops == [child, parent]
    assert child.ops == [fk]
