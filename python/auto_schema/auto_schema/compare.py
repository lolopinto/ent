from alembic.autogenerate import comparators
from . import ops
from alembic.operations import Operations, MigrateOperation
import sqlalchemy as sa
import pprint
from sqlalchemy.dialects import postgresql
import alembic.operations.ops as alembicops


@comparators.dispatch_for("schema")
def compare_edges(autogen_context, upgrade_ops, schemas):
    db_edges = {}

    for sch in schemas:

        # so first check if the table exists. if it doesn't, nothing to do here
        # TODO not using schema here either
        # https://github.com/lolopinto/ent/issues/123
        if not _table_exists(autogen_context):
            continue

        existing_edges = {}

        # get existing edges from db
        query = "SELECT * FROM assoc_edge_config"
        for row in autogen_context.connection.execute(query):
            edge = dict(row)
            existing_edges[edge['edge_name']] = edge

        db_edges[_get_schema_key(sch)] = existing_edges

    metadata_edges = autogen_context.metadata.info.setdefault("edges", {})

    # edges in metadata, but not in db, new edges that need to be added
    _process_edges(
        metadata_edges,
        db_edges,
        upgrade_ops,
        ops.AddEdgesOp,
        _meta_to_db_edge_mismatch,
    )

    # edges in db, but not in metadata, edges that need to be dropped
    _process_edges(
        db_edges,
        metadata_edges,
        upgrade_ops,
        ops.RemoveEdgesOp,
    )


def _process_edges(source_edges, compare_edges, upgrade_ops, upgrade_op, edge_mismatch_fn=None):
    alter_ops = []

    for sch, edges in source_edges.items():

        new_edges = []

        edges_for_sch = compare_edges.get(sch)
        if edges_for_sch is None:
            edges_for_sch = {}

        for k, edge in edges.items():
            compare_edge = edges_for_sch.get(edge['edge_name'])

            # for now we assume that the contents are the same. TODO, eventually support modifying edges.
            # not something we support for now
            # TODO we need modify_edge
            if compare_edge is None:
                new_edges.append(edge)
            else:
                # edge exists, let's confirm inverse_edge_type is the same
                # that's the only thing we think should change/support changing
                # convert to string to handle mismatch types e.g. str and UUID
                if str(compare_edge.get('inverse_edge_type', None)) != str(edge.get('inverse_edge_type', None)) and edge_mismatch_fn is not None:
                    alter_op = edge_mismatch_fn(edge, compare_edge, sch)
                    alter_ops.append(alter_op)
                    pass

        if len(new_edges) > 0:
            upgrade_ops.ops.append(
                upgrade_op(new_edges, schema=sch)
            )

        # do any alter operation after the add/remove edge op
        [upgrade_ops.ops.append(alter_op) for alter_op in alter_ops]


# why isn't this just metadata.sorted_tables?
def _table_exists(autogen_context):
    dialect_map = {
        'sqlite': _execute_sqlite_dialect,
        'postgresql': _execute_postgres_dialect,
    }

    dialect = autogen_context.metadata.bind.dialect.name

    if dialect_map[dialect] is None:
        raise Exception("unsupported dialect")

    return dialect_map[dialect](autogen_context.connection)


def _execute_postgres_dialect(connection):
    row = connection.execute(
        "SELECT to_regclass('%s') IS NOT NULL as exists" % (
            "assoc_edge_config")
    )
    res = row.first()
    return res['exists']


def _execute_sqlite_dialect(connection):
    row = connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='%s'" % (
            "assoc_edge_config")
    )
    res = row.first()
    return res is not None


def _get_schema_key(schema):
    if schema is None:
        return 'public'
    return schema


def _meta_to_db_edge_mismatch(meta_edge, db_edge, sch):
    return ops.ModifyEdgeOp(
        meta_edge['edge_type'],
        meta_edge,
        db_edge,
        schema=sch
    )


def _create_tuple_key(row, pkeys):
    l = []
    for key in pkeys:
        if not key in row:
            raise ValueError("pkey %s was not found in row" % key)
        l.append(row[key])
    return tuple(l)


@comparators.dispatch_for('schema')
def compare_data(autogen_context, upgrade_ops, schemas):
    # TODO not using schema correctly
    # https: // github.com/lolopinto/ent/issues/123

    data = autogen_context.metadata.info.setdefault("data", {})

    inspector = autogen_context.inspector
    db_metadata = sa.MetaData()
    db_metadata.reflect(inspector.bind)

    for sch in schemas:
        sch = _get_schema_key(sch)

        if not sch in data:
            continue

        schema_data = data.get(sch, {})
        for table_name in schema_data:
            table_data = schema_data[table_name]

            pkeys = table_data.get('pkeys', None)
            if pkeys is None or not isinstance(pkeys, list):
                raise ValueError("pkeys needs to be a list")

            rows = table_data.get('rows', None)
            if rows is None or not isinstance(rows, list):
                # we want list of dict...
                raise ValueError("rows needs to be a list")

            # verify that each row is valid + create tuple key
            data_rows = {_create_tuple_key(row, pkeys): row for row in rows}

            # new table. need to add
            if not table_name in db_metadata.tables:
                upgrade_ops.ops.append(ops.AddRowsOp(
                    table_name, pkeys, rows))
            else:
                _compare_db_values(autogen_context, upgrade_ops,
                                   table_name, pkeys, data_rows)


def _compare_db_values(autogen_context, upgrade_ops, table_name, pkeys, data_rows):
    connection = autogen_context.connection
    query = 'SELECT * FROM %s' % table_name

    db_rows = {}
    for row in connection.execute(query):
        d = dict(row)
        t = _create_tuple_key(d, pkeys)
        db_rows[t] = d

    deleted_rows = []
    new_rows = []
    modified_new_rows = []
    modified_old_rows = []
    for t in db_rows:
        db_row = db_rows[t]
        if t in data_rows:
            data_row = data_rows[t]
            if db_row != data_row:
                # check to see if keys are the same
                # check db since it has all the keys
                for key in db_row:
                    if db_row[key] != data_row.get(key, None):
                        modified_new_rows.append(data_row)
                        modified_old_rows.append(db_row)
                        break
        else:
            deleted_rows.append(db_row)

    for t in data_rows:
        if t not in db_rows:
            new_rows.append(data_rows[t])

    if len(new_rows) > 0:
        upgrade_ops.ops.append(ops.AddRowsOp(
            table_name, pkeys, new_rows))

    if len(deleted_rows) > 0:
        upgrade_ops.ops.append(ops.RemoveRowsOp(
            table_name, pkeys, deleted_rows))

    if len(modified_new_rows) > 0:
        if len(modified_new_rows) != len(modified_old_rows):
            raise ValueError(
                "length of modified old and new rows should be the same")

        upgrade_ops.ops.append(ops.ModifyRowsOp(
            table_name, pkeys, modified_new_rows, modified_old_rows))


@comparators.dispatch_for("schema")
def compare_schema(autogen_context, upgrade_ops, schemas):
    inspector = autogen_context.inspector

    db_metadata = sa.MetaData()
    db_metadata.reflect(inspector.bind)

    # TODO schema not being used
    # https://github.com/lolopinto/ent/issues/123
    for sch in schemas:
        conn_tables = {
            table.name: table for table in db_metadata.sorted_tables}
        metadata_tables = {
            table.name: table for table in autogen_context.metadata.sorted_tables}

        # trying to detect change in tables
        for name in conn_tables:
            if name in metadata_tables:
                _check_existing_table(
                    conn_tables[name], metadata_tables[name], upgrade_ops, sch)
            else:
                _check_removed_table(conn_tables[name], upgrade_ops, sch)

        for name in metadata_tables:
            if not name in conn_tables:
                _check_new_table(metadata_tables[name], upgrade_ops, sch)


def _check_removed_table(metadata_table, upgrade_ops, sch):
    for column in metadata_table.columns:
        _check_removed_column(column, upgrade_ops, sch)


def _check_existing_table(conn_table, metadata_table, upgrade_ops, sch):
    conn_columns = {col.name: col for col in conn_table.columns}
    metadata_columns = {
        col.name: col for col in metadata_table.columns}

    for name in conn_columns:
        if not name in metadata_columns:
            # dropped column (potentially dropped type)
            _check_removed_column(conn_columns[name], upgrade_ops, sch)
        else:
            _check_if_enum_values_changed(
                upgrade_ops, conn_columns[name], metadata_columns[name], sch)

    for name in metadata_columns:
        if not name in conn_columns:
            _check_new_column(metadata_columns[name], upgrade_ops, sch)

    conn_constraints = {
        constraint.name: constraint for constraint in conn_table.constraints}
    meta_constraints = {
        constraint.name: constraint for constraint in metadata_table.constraints}

    new_ops = []

    for name in conn_constraints:
        # no name, ignore
        # we don't do anything with None constraints and if we get here
        # it's something autogenerated or something else
        if name is None:
            continue

        constraint = conn_constraints[name]
        if not name in meta_constraints and isinstance(constraint, sa.CheckConstraint):
            if not constraint._type_bound:
                new_ops.append(
                    ops.OurDropConstraintOp.from_constraint(constraint))

    for name in meta_constraints:
        constraint = meta_constraints[name]
        if not name in conn_constraints and isinstance(constraint, sa.CheckConstraint):
            if not constraint._type_bound:
                new_ops.append(
                    ops.OurCreateCheckConstraintOp.from_constraint(constraint))

    if len(new_ops) <= 0:
        return

    existing_op = False
    for index, op in enumerate(upgrade_ops.ops):
        if not isinstance(op, alembicops.ModifyTableOps):
            continue
        if op.table_name != metadata_table.name:
            continue

        existing_op = True
        l = list(op.ops)
        # append the new ops to existing modify table ops for that table
        [l.append(new_op) for new_op in new_ops]
        # swap out the modify table ops object with new one with new ops
        upgrade_ops.ops[index] = alembicops.ModifyTableOps(
            metadata_table.name, l, schema=sch
        )
        break

    if not existing_op:
        upgrade_ops.ops.append(
            alembicops.ModifyTableOps(
                metadata_table.name, new_ops, schema=sch)
        )


def _check_new_column(metadata_column, upgrade_ops, sch):
    metadata_type = metadata_column.type
    if not isinstance(metadata_type, postgresql.ENUM):
        return

    # new column with enum type
    # time to create the type
    # adding a new type. just add to front of list
    upgrade_ops.ops.insert(
        0,
        ops.AddEnumOp(metadata_type.name, metadata_type.enums, schema=sch)
    )


def _check_removed_column(conn_column, upgrade_ops, sch):
    conn_type = conn_column.type
    if not isinstance(conn_type, postgresql.ENUM):
        return

    # column being removed. remove type also
    # we assume 1-1 for now
    upgrade_ops.ops.append(
        ops.DropEnumOp(conn_type.name, conn_type.enums, schema=sch)
    )


def _check_new_table(metadata_table, upgrade_ops, sch):
    for column in metadata_table.columns:
        _check_new_column(column, upgrade_ops, sch)


def _check_if_enum_values_changed(upgrade_ops, conn_column, metadata_column, sch):
    conn_type = conn_column.type
    metadata_type = metadata_column.type

    # not enums, bye
    if not isinstance(conn_type, postgresql.ENUM) or not isinstance(metadata_type, postgresql.ENUM):
        return

    # enums are the same, bye
    if conn_type.enums == metadata_type.enums:
        return

    conn_enums = {k: k for k in conn_type.enums}
    metadata_enums = {k: k for k in metadata_type.enums}
    for key in conn_enums:
        if key not in metadata_enums:
            raise ValueError("postgres doesn't support enum removals")

    l = len(metadata_type.enums)
    for index, value in enumerate(metadata_type.enums):
        if value not in conn_enums:
            # if not last item use BEFORE
            # options are:
            # ALTER TYPE enum_type ADD VALUE 'new_value';
            # ALTER TYPE enum_type ADD VALUE 'new_value' BEFORE 'old_value';
            # we don't need after since the previous 2 suffice so don't officially support that
            # ALTER TYPE enum_type ADD VALUE 'new_value' AFTER 'old_value';
            # only add before if previously existed
            if index != l - 1 and metadata_type.enums[index+1] in conn_enums:
                upgrade_ops.ops.append(
                    ops.AlterEnumOp(conn_type.name, value, schema=sch,
                                    before=metadata_type.enums[index + 1])
                )
            else:
                upgrade_ops.ops.append(
                    ops.AlterEnumOp(conn_type.name, value, schema=sch)
                )
