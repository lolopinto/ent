"""Ordering rules for Ent's Alembic operations.

Upgrade phases: extension/type setup, FK removal, table/index changes, FK
creation, then seed/edge data changes. Within a type-changing table, constraints
and replaced indexes drop before ALTER TYPE. Alembic reverses that sequence for downgrade;
only irreversible guards and extension namespace restoration must move ahead
of the reversed operations. Keep both directions here as new operations arise.
Edge-config cleanup is a pre-drop exception to the normal trailing data phase.
"""

import uuid

import alembic.operations.ops as alembicops
import sqlalchemy as sa

from . import ops


_EXTENSION_SETUP = (ops.CreateExtensionOp, ops.UpdateExtensionOp, ops.SetExtensionSchemaOp)
_ENUM_SETUP = (ops.AddEnumOp, ops.AlterEnumOp)
_INDEX_DROPS = (alembicops.DropIndexOp, ops.DropFullTextIndexOp)
_TABLE_DDL = (alembicops.ModifyTableOps, alembicops.CreateTableOp, alembicops.DropTableOp)
_EDGE_OPERATIONS = (ops.AddEdgesOp, ops.RemoveEdgesOp, ops.ModifyEdgeOp)


def order_upgrade(upgrade_ops, *, dialect_name):
    # Comparators only collect operations. Resolve ordering once, after every
    # table is known and before Alembic constructs the inverse migration.
    extensions, enums, tables, remaining = [], [], [], []
    for operation in upgrade_ops.ops:
        if isinstance(operation, _EXTENSION_SETUP):
            extensions.append(operation)
        elif isinstance(operation, _ENUM_SETUP):
            enums.append(operation)
        elif isinstance(operation, _TABLE_DDL):
            tables.append(operation)
            if isinstance(operation, alembicops.ModifyTableOps):
                _order_column_type_changes(operation)
        else:
            remaining.append(operation)
    # Preserve enum label insertion order, including BEFORE relationships.
    upgrade_ops.ops[:] = extensions + enums + tables + remaining
    if dialect_name == "postgresql":
        _order_foreign_keys_for_index_changes(upgrade_ops)
    _order_edge_config_cleanup(upgrade_ops)


def _order_column_type_changes(table_ops):
    if not any(
        isinstance(op, alembicops.AlterColumnOp) and op.modify_type is not None
        for op in table_ops.ops
    ):
        return
    index_drops = [op for op in table_ops.ops if isinstance(op, _INDEX_DROPS)]
    if not index_drops:
        return
    # ALTER TYPE reparses existing predicates using the new type. Remove old
    # indexes while they are valid, after constraints that may depend on them.
    constraint_drops = [op for op in table_ops.ops if isinstance(op, alembicops.DropConstraintOp)]
    drops = constraint_drops + index_drops
    table_ops.ops[:] = drops + [op for op in table_ops.ops if op not in drops]


def _order_foreign_keys_for_index_changes(upgrade_ops):
    if not any(
        isinstance(operation, _INDEX_DROPS)
        for table_ops in upgrade_ops.ops if isinstance(table_ops, alembicops.ModifyTableOps)
        for operation in table_ops.ops
    ):
        return

    # An index can support a foreign key on any table. Complete table comparison
    # before moving FK drops ahead of index replacements and FK creates after
    # them. Alembic then reverses this complete sequence for downgrade, preserving
    # the same dependencies there instead of relying on table-name ordering.
    foreign_key_drops, foreign_key_creates, remaining = [], [], []
    for table_ops in upgrade_ops.ops:
        if isinstance(table_ops, alembicops.CreateTableOp):
            # New tables also depend on indexes changed later in this migration.
            # Keep the table operation and all other constraints/options intact;
            # explicit late FK creation gives downgrade an early FK drop too.
            creates = []
            for item in table_ops.columns:
                if not isinstance(item, sa.ForeignKeyConstraint):
                    continue
                operation = alembicops.CreateForeignKeyOp.from_constraint(item)
                if operation.constraint_name is None:
                    # An inline FK normally drops with its table. Once deferred,
                    # its inverse DROP CONSTRAINT needs a stable explicit name.
                    signature = (
                        operation.source_table, operation.referent_table,
                        operation.local_cols, operation.remote_cols, sorted(operation.kw.items()),
                    )
                    operation.constraint_name = f"ent_fk_{uuid.uuid5(uuid.NAMESPACE_OID, repr(signature)).hex}"
                creates.append(operation)
            if creates:
                table_ops.columns = [item for item in table_ops.columns if not isinstance(item, sa.ForeignKeyConstraint)]
                foreign_key_creates.append(alembicops.ModifyTableOps(table_ops.table_name, creates, schema=table_ops.schema))
            remaining.append(table_ops)
            continue
        if not isinstance(table_ops, alembicops.ModifyTableOps):
            remaining.append(table_ops)
            continue
        drops, creates, other = [], [], []
        for operation in table_ops.ops:
            if isinstance(operation, alembicops.DropConstraintOp) and operation.constraint_type == "foreignkey":
                drops.append(operation)
            elif isinstance(operation, alembicops.CreateForeignKeyOp):
                creates.append(operation)
            else:
                other.append(operation)
        if drops:
            foreign_key_drops.append(alembicops.ModifyTableOps(table_ops.table_name, drops, schema=table_ops.schema))
        if creates:
            foreign_key_creates.append(alembicops.ModifyTableOps(table_ops.table_name, creates, schema=table_ops.schema))
        if other:
            table_ops.ops[:] = other
            remaining.append(table_ops)

    # Keep extension/enum setup ahead of table DDL. Preserve every table/schema
    # attribute on the moved operations.
    position = next((
        i for i, operation in enumerate(remaining)
        if isinstance(operation, _TABLE_DDL)
    ), len(remaining))
    ddl_end = max(i + 1 for i, operation in enumerate(remaining) if isinstance(operation, _TABLE_DDL))
    # Seed/edge changes must see the new FK actions. Inverse data operations then
    # run before the FK is reversed, preserving the migration's data dependencies.
    upgrade_ops.ops[:] = (
        remaining[:position] + foreign_key_drops + remaining[position:ddl_end]
        + foreign_key_creates + remaining[ddl_end:]
    )


def _order_edge_config_cleanup(upgrade_ops):
    drop = next((
        op for op in upgrade_ops.ops
        if isinstance(op, alembicops.DropTableOp) and op.table_name == "assoc_edge_config"
    ), None)
    if drop is None:
        return
    # Edge operations access assoc_edge_config. When that table is removed,
    # cleanup must precede the drop; the inverse creates it before restoring
    # edges. Ordinary seed changes retain their position after FK creation.
    edge_ops = [op for op in upgrade_ops.ops if isinstance(op, _EDGE_OPERATIONS)]
    remaining = [op for op in upgrade_ops.ops if not isinstance(op, _EDGE_OPERATIONS)]
    position = remaining.index(drop)
    upgrade_ops.ops[:] = remaining[:position] + edge_ops + remaining[position:]


def order_downgrade(downgrade_ops):
    guards = [op for op in downgrade_ops.ops if isinstance(op, ops.NoDowngradeOp)]
    schema_moves = [op for op in downgrade_ops.ops if isinstance(op, ops.SetExtensionSchemaOp)]
    # Reject irreversible revisions before SQL or an autocommit block can run.
    # Namespace moves preserve object identities and must precede parsing the
    # restored index predicates/types, even though upgrade reversal puts them last.
    first = guards + schema_moves
    if first:
        downgrade_ops.ops[:] = first + [op for op in downgrade_ops.ops if op not in first]
