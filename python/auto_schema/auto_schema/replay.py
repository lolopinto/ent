"""Preserve revision order where custom SQL observes an intermediate schema or data."""

from collections import defaultdict
from contextlib import contextmanager
import copy
import io

from alembic.migration import MigrationContext
from alembic.operations import Operations
import alembic.operations.ops as ddl
import sqlalchemy as sa

from . import ops


def _collect_history(revisions, connection, include, exclude, upgrade):
    history = []
    # Any SQL written outside a recorded operation (e.g. via get_bind())
    # would be lost when the original revision files are replaced.
    untracked = io.StringIO()
    mc = MigrationContext.configure(
        connection=connection,
        opts={"as_sql": True, "output_buffer": untracked, "transactional_ddl": False},
    )
    # Alembic 1.18 Operations.context() removes its proxy only on normal exit.
    operations = Operations(mc)
    operations._install_proxy()
    try:
        batch_alter_table = operations.batch_alter_table

        def record(op):
            if isinstance(op, (ops.ExecuteSQL, ddl.ExecuteSQLOp)):
                if keep_custom:
                    current.append((op, rev.revision))
            elif isinstance(
                op,
                (
                    ddl.CreateTableOp,
                    ddl.DropTableOp,
                    ddl.AlterTableOp,
                    ddl.AddConstraintOp,
                    ddl.DropConstraintOp,
                    ddl.CreateIndexOp,
                    ddl.DropIndexOp,
                    ops.MigrateOpInterface,
                ),
            ):
                current.append((op, None))
            elif keep_custom:
                raise ValueError(
                    f"revision {rev.revision} has an untracked operation "
                    f"{type(op).__name__}"
                )
            if isinstance(op, ddl.CreateTableOp):
                # Revisions may use the Table returned by op.create_table().
                return op.to_table(mc)

        @contextmanager
        def record_batch(*args, **kwargs):
            with batch_alter_table(*args, **kwargs) as batch:
                # Alembic executes batch.execute() immediately and flushes
                # structural changes on exit. Only collect those operations.
                pending = []

                def invoke(op):
                    if isinstance(op, ddl.ExecuteSQLOp):
                        return record(op)
                    pending.append(op)

                batch.invoke = invoke
                batch.impl.recreate = "never"
                yield batch
                for op in pending:
                    record(op)

        operations.invoke = record
        operations.batch_alter_table = record_batch
        for rev in revisions:
            keep_custom = (
                rev.revision in include if include else rev.revision not in exclude
            )
            current = []
            # An excluded downgrade may be irreversible. Its upgrade still
            # supplies positions for the generated operations in that revision.
            forward = upgrade or not keep_custom
            if forward:
                rev.module.upgrade()
            else:
                rev.module.downgrade()
            for op, revision in current if forward else reversed(current):
                history.append((op, revision, forward))
            if keep_custom and untracked.tell():
                raise ValueError(
                    f"revision {rev.revision} emitted untracked SQL. "
                    "Use op.execute() or op.execute_sql() for fresh installs."
                )
            untracked.seek(0)
            untracked.truncate()
    finally:
        operations._remove_proxy()
    return history


class _Positions:
    """Count preceding custom statements in creation order for both directions."""

    def __init__(self, history):
        self.custom = []
        self.tables = {}
        self.extensions = {}
        self.columns = defaultdict(dict)
        self.initial_defaults = defaultdict(dict)
        self.defaults = defaultdict(lambda: defaultdict(list))
        self.indexes = {}
        self.constraints = {}
        self.seeds = defaultdict(list)
        for op, revision, forward in history:
            phase = len(self.custom)
            if revision is not None:
                self.custom.append((op, revision))
            elif isinstance(op, (ops.CreateExtensionOp, ops.DropExtensionOp)):
                self.extensions[op.extension["name"]] = phase
            elif isinstance(op, (ddl.CreateTableOp, ddl.DropTableOp)):
                key = (op.schema, op.table_name)
                self.tables[key] = phase
                self.columns[key].clear()
                self.initial_defaults[key] = {
                    col.name: col.server_default
                    for col in getattr(op, "columns", ())
                    if isinstance(col, sa.Column)
                }
                self.defaults[key].clear()
                self.seeds[key].clear()
            elif isinstance(op, (ddl.AddColumnOp, ddl.DropColumnOp)):
                name = (
                    op.column.name
                    if isinstance(op, ddl.AddColumnOp)
                    else op.column_name
                )
                key = (op.schema, op.table_name)
                self.columns[key][name] = phase
                self.defaults[key][name].clear()
                if isinstance(op, ddl.AddColumnOp):
                    self.initial_defaults[key][name] = op.column.server_default
            elif (
                isinstance(op, ddl.AlterColumnOp)
                and op.modify_server_default is not False
            ):
                self.defaults[op.schema, op.table_name][op.column_name].append(
                    (phase, op, forward)
                )
            elif isinstance(
                op,
                (
                    ddl.CreateIndexOp,
                    ddl.DropIndexOp,
                    ops.CreateFullTextIndexOp,
                    ops.DropFullTextIndexOp,
                ),
            ):
                self.indexes[op.schema, op.index_name] = phase
            elif isinstance(op, (ddl.AddConstraintOp, ddl.DropConstraintOp)):
                if isinstance(op, ddl.CreateForeignKeyOp):
                    key = (op.kw.get("source_schema"), op.source_table)
                else:
                    key = (op.schema, op.table_name)
                self.constraints[key, op.constraint_name] = phase
            elif isinstance(op, (ops.AddRowsOp, ops.RemoveRowsOp, ops.ModifyRowsOp)):
                self.seeds[op.schema, op.table_name].append(
                    (phase, op if forward else op.reverse())
                )


def interleave(generated, revisions, metadata, mc, include, exclude):
    connection = mc.connection
    upgrade = isinstance(generated, ddl.UpgradeOps)
    history = _collect_history(revisions, connection, include, exclude, upgrade)
    pos = _Positions(history)
    if not pos.custom:
        return {}

    tables = {(t.schema, t.name): t for t in metadata.sorted_tables}
    table_phase = pos.tables.copy()
    for key, table in reversed(tables.items()):
        for fk in table.foreign_key_constraints:
            parent = (fk.referred_table.schema, fk.referred_table.name)
            needed = max(
                table_phase.get(key, 0),
                pos.constraints.get((key, fk.name), 0),
                *(pos.columns[key].get(col.name, 0) for col in fk.columns),
            )
            table_phase[parent] = min(needed, table_phase.get(parent, 0))

    # An index newly declared in metadata can depend on a column added later.
    for key, table in tables.items():
        for index in table.indexes:
            name = (table.schema, index.name)
            phase = pos.indexes.get(name, table_phase.get(key, 0))
            for col in index.columns:
                phase = max(phase, pos.columns[key].get(col.name, 0))
            pos.indexes[name] = phase

    phases = [[] for _ in range(len(pos.custom) + 1)]
    for op in generated.ops if upgrade else reversed(generated.ops):
        if isinstance(op, (ops.CreateExtensionOp, ops.DropExtensionOp)):
            name = op.extension["name"]
            requires = mc.opts.get("ent_extension_prerequisites", {}).get(name, [])
            # Generated extensions are already in topological creation order.
            phase = max(
                [pos.extensions.get(name, 0)]
                + [pos.extensions.get(dep, 0) for dep in requires]
            )
            pos.extensions[name] = phase
            phases[phase].append(op)
        elif isinstance(op, (ddl.CreateTableOp, ddl.DropTableOp)):
            _place_table(
                op, phases, pos, table_phase, tables, upgrade, connection.dialect.name
            )
        elif isinstance(op, ddl.ModifyTableOps):
            key = (op.schema, op.table_name)
            for child in op.ops if upgrade else reversed(op.ops):
                phase = table_phase.get(key, 0)
                if hasattr(child, "index_name"):
                    phase = pos.indexes.get((op.schema, child.index_name), phase)
                phases[phase].append(child)
        elif isinstance(op, (ops.AddRowsOp, ops.RemoveRowsOp)):
            key = (op.schema, op.table_name)
            _place_seed_rows(
                op, phases, pos.seeds[key], table_phase.get(key, 0), upgrade
            )
        elif isinstance(op, (ops.AddEdgesOp, ops.RemoveEdgesOp, ops.ModifyEdgeOp)):
            # Edge declarations use "public" for a schema-less metadata table.
            key = (op.schema, "assoc_edge_config")
            if key not in tables:
                key = (None, "assoc_edge_config")
            phases[table_phase.get(key, 0)].append(op)
        else:
            phases[0].append(op)

    ordered = []
    headers = {}
    previous_revision = None
    for i, phase_ops in enumerate(phases):
        ordered.extend(phase_ops)
        if i < len(pos.custom):
            op, revision = pos.custom[i]
            if phase_ops or revision != previous_revision:
                headers[op] = revision
            ordered.append(op)
            previous_revision = revision
    generated.ops[:] = ordered if upgrade else reversed(ordered)
    return headers


def _place_seed_rows(snapshot, phases, history, table_phase, upgrade):
    # Custom SQL may read an earlier value, or a row removed from the final
    # declaration. Replay seed operations before the last custom statement,
    # then reconcile those rows with the current metadata.
    def by_key(rows):
        return {tuple(row[col] for col in snapshot.pkeys): row for row in rows}

    last = len(phases) - 1
    rows = {}
    for phase, change in history:
        if phase == last:
            break
        phases[phase].append(change if upgrade else change.reverse())
        changed = by_key(change.rows)
        if isinstance(change, ops.RemoveRowsOp):
            for key in changed:
                rows.pop(key, None)
        else:
            rows.update(changed)

    target = by_key(snapshot.rows)
    phase = last if history else table_phase
    added = [row for key, row in target.items() if key not in rows]
    removed = [row for key, row in rows.items() if key not in target]
    modified = [key for key in target if key in rows and target[key] != rows[key]]
    args = snapshot.table_name, snapshot.pkeys
    changes = []
    if added:
        changes.append(ops.AddRowsOp(*args, added, schema=snapshot.schema))
    if removed:
        changes.append(ops.RemoveRowsOp(*args, removed, schema=snapshot.schema))
    if modified:
        changes.append(
            ops.ModifyRowsOp(
                *args,
                [target[key] for key in modified],
                [rows[key] for key in modified],
                schema=snapshot.schema,
            )
        )
    phases[phase].extend(change if upgrade else change.reverse() for change in changes)


def _place_table(op, phases, pos, table_phase, tables, upgrade, dialect):
    key = (op.schema, op.table_name)
    phase = table_phase.get(key, 0)
    if dialect != "postgresql":
        phases[phase].append(op)
        return

    table = tables[key]
    create = op if upgrade else ddl.CreateTableOp.from_table(table)
    initial = []
    deferred_constraints = []
    for item in create.columns:
        if isinstance(item, sa.Constraint):
            constraint_phase = pos.constraints.get((key, item.name), phase)
            for col in item.columns:
                constraint_phase = max(
                    constraint_phase, pos.columns[key].get(col.name, phase)
                )
            if isinstance(item, sa.ForeignKeyConstraint):
                for element in item.elements:
                    parent = (element.column.table.schema, element.column.table.name)
                    constraint_phase = max(
                        constraint_phase,
                        pos.columns[parent].get(element.column.name, 0),
                    )
            if constraint_phase <= phase:
                initial.append(item)
                continue
            if isinstance(item, sa.CheckConstraint):
                change = ops.OurCreateCheckConstraintOp.from_constraint(item)
            else:
                change = ddl.AddConstraintOp.from_constraint(item)
            if upgrade or change.constraint_name is not None:
                deferred_constraints.append(
                    (constraint_phase, change if upgrade else change.reverse())
                )
            continue
        if not isinstance(item, sa.Column):
            initial.append(item)
            continue
        added = pos.columns[key].get(item.name, phase)
        column = _place_defaults(item, phases, pos, key, max(added, phase), upgrade)
        if added > phase:
            # ADD applies the default to rows already inserted by custom SQL.
            if column.unique or column.index:
                # The snapshot carries unique constraints and indexes as
                # separate operations. Avoid Alembic adding them a second time.
                column = column._copy()
                column.unique = column.index = False
            change = ddl.AddColumnOp(op.table_name, column, schema=op.schema)
            phases[added].append(change if upgrade else change.reverse())
        else:
            initial.append(column)

    if upgrade:
        op = copy.copy(create)
        op.columns = initial
    phases[phase].append(op)
    for constraint_phase, change in deferred_constraints:
        phases[constraint_phase].append(change)


def _place_defaults(column, phases, pos, key, added, upgrade):
    # A later SET DEFAULT affects future inserts. ADD COLUMN must still use
    # the original default to backfill rows inserted before the column existed.
    changes = pos.defaults[key][column.name]
    original = pos.initial_defaults[key].get(column.name)
    born = pos.tables.get(key, added)
    late = []
    if born > added and isinstance(column.server_default, sa.DefaultClause):
        late.append((born, original if upgrade else None))
        original = None
    for phase, change, forward in changes:
        if phase <= added:
            original = change.modify_server_default
        elif upgrade or not forward:
            late.append((phase, change.modify_server_default))
        else:
            late.append(
                (
                    phase,
                    None
                    if change.existing_server_default is False
                    else change.existing_server_default,
                )
            )
    if not late:
        return column

    if upgrade:
        # The last historical edit installs the current declared default.
        late[-1] = (late[-1][0], column.server_default)
    for phase, default in late:
        phases[phase].append(
            ddl.AlterColumnOp(
                key[1],
                column.name,
                schema=key[0],
                existing_type=column.type,
                modify_server_default=default,
            )
        )
    if not upgrade:
        return column
    column = column._copy()
    if original is not None and not isinstance(original, sa.FetchedValue):
        original = sa.DefaultClause(original)
    column.server_default = original
    if original is None:
        column.autoincrement = False
    return column
