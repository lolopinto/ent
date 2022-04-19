# from curses import meta
# from enum import auto, unique
# from queue import Full
from alembic.autogenerate import comparators
from alembic.autogenerate.api import AutogenContext

from auto_schema.schema_item import FullTextIndex
from . import ops
from alembic.operations import Operations, MigrateOperation
import sqlalchemy as sa
from sqlalchemy.engine import reflection
import pprint
import re
from sqlalchemy.dialects import postgresql
import alembic.operations.ops as alembicops
from typing import Optional
# from typing import Union


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


def _dialect_name(autogen_context: AutogenContext) -> str:
    return autogen_context.metadata.bind.dialect.name


# why isn't this just metadata.sorted_tables?
def _table_exists(autogen_context):
    dialect_map = {
        'sqlite': _execute_sqlite_dialect,
        'postgresql': _execute_postgres_dialect,
    }

    dialect = _dialect_name(autogen_context)

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


# this should be in a table comparison...
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

    conn_indexes = {
        index.name: index for index in conn_table.indexes}
    meta_indexes = {
        index.name: index for index in metadata_table.indexes}

    # full text index not even reflected omg
#    print("indexesssss", conn_indexes, meta_indexes)

    # TODO replace with our own index
#     for name, index in conn_indexes.items():
#         if not name in meta_indexes and isinstance(index, FullTextIndex):
#             # DROP
#             print("dropped index")
#             new_ops.append(
#                 ops.DropFullTextIndexOp(
#                     index.name,
#                     index.table.name,
#                     info=index.info,
#                     #                    *index.kw
#                 )
#             )

#     for name, index in meta_indexes.items():
#         if not name in conn_indexes and isinstance(index, FullTextIndex):
#             print('meta full text index', index.name)

#             cols = [col.name for col in index.columns]
# #            print(cols, index.info, index.table, index.unique)
#             new_ops.append(
#                 ops.CreateFullTextIndexOp(
#                     index.name,
#                     index.table.name,
#                     *cols,
#                     unique=index.unique,
#                     info=index.info,
#                     #                    *index.kw
#                 )
#             )

# To add
#             print(index.info)
#             for op in upgrade_ops.ops:
#                 #                print(op)
#                 if not isinstance(op, alembicops.ModifyTableOps):
#                     continue

# #                print(op.table_name, metadata_table.name)
#                 if op.table_name != metadata_table.name:
#                     continue

#  #               if index.info is None:
# #                    continue

# #                print(len(op.ops))
#                 for idx, op2 in enumerate(op.ops):
#                     print(idx, op2)
#                     if isinstance(
#                             op2, alembicops.CreateIndexOp) and op2.index_name == index.name:
#                         cols = [col.name for col in op2.columns]
#                         # TODO need kw and info here so we can pass that
#  #                       print(op2.kw, op2.info)
# #                        op.ops[idx] =
#                         ops.CreateFullTextIndexOp(
#                             op2.index_name,
#                             op2.table_name,
#                             *cols,
#                             info=op2.info,
#                             *op2.kw
#                         )

#                            op2.index_name, *cols, info=op2.info, *op2.kw)
    # print("ssssss")
    # print(op2)
#                print(index.info)

    # l = [op for op in list(op.ops) if isinstance(
    #     op, alembicops.CreateIndexOp) and op.index_name == index.name]
    # # find existing create index, we need to replace it with ours
    # if l:
    #     # TODO replace with our own ...
    #     # TODO ...
    #     [print(op.info) for op in l]

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


@comparators.dispatch_for("table")
def _compare_indexes(autogen_context: AutogenContext,
                     modify_table_ops: alembicops.ModifyTableOps,
                     schema,
                     tname: str,
                     conn_table: Optional[sa.Table],
                     metadata_table: sa.Table,
                     ):

    # print('dialect', autogen_context.dialect)
    # print(conn_table is None, metadata_table is None)
    #    autogen_context.

    missing_conn_indexes = _get_raw_db_indexes(autogen_context, conn_table)
    conn_indexes = {}
    meta_indexes = {}
    # if conn_table is not None:
    #     print(len(conn_table.indexes), len(metadata_table.indexes))
    if conn_table is not None:
        # db_indexes = autogen_context.dialect.get_indexes(
        #     autogen_context.connection, conn_table.name, schema)
        # print("Db", db_indexes)

        conn_indexes = {
            index.name: index for index in conn_table.indexes}
#         print("conn constraints", conn_table.constraints)

    if metadata_table is not None:
        # accounts_unique_phone_number not showing up in indexes and constraints is concerning
        meta_indexes = {
            index.name: index for index in metadata_table.indexes}

    print("indexesssss",
          conn_indexes,
          meta_indexes,
          #   metadata_table.indexes,
          #   metadata_table.constraints,
          )

    # not getting this conn index from db. maybe related
    for name, index in conn_indexes.items():
        if not name in meta_indexes and isinstance(index, FullTextIndex):
            # DROP
            print("dropped index")
#            modify_table_ops.ops
            modify_table_ops.ops.append(
                ops.DropFullTextIndexOp(
                    index.name,
                    index.table.name,
                    info=index.info,
                    table=conn_table,
                    #                    *index.kw
                )
            )

    for name, v in missing_conn_indexes.items():
        if not name in meta_indexes:
            print("vvvvv", v)
            modify_table_ops.ops.append(
                ops.DropFullTextIndexOp(
                    name,
                    conn_table.name,
                    table=conn_table,
                    info=v,
                    # TODO info...
                    #                    info=index.info,
                    #                    *index.kw
                )
            )

    for name, index in meta_indexes.items():
        if not name in conn_indexes and isinstance(index, FullTextIndex):
            print('meta full text index', index.name)

            idx = None
            for i in range(len(modify_table_ops.ops)):
                op = modify_table_ops.ops[i]
                if isinstance(op, alembicops.CreateIndexOp) and op.index_name == index.name:
                    idx = i
                    print("found!")
                    break

            # find existing create index op and replace with ours
            if idx is not None:
                cols = [col.name for col in index.columns]
        #        print(cols, index.info, index.table, index.unique)

                modify_table_ops.ops[idx] = ops.CreateFullTextIndexOp(
                    index.name,
                    index.table.name,
                    #                    *cols,
                    schema=schema,
                    table=index.table,
                    unique=index.unique,
                    info=index.info,
                    #                    *index.kw
                )


index_regex = re.compile('CREATE INDEX (.+) USING (gin|btree)(.+)')

# TODO
# @reflection.cache


def _get_raw_db_indexes(autogen_context: AutogenContext, conn_table: Optional[sa.Table]):
    if conn_table is None or _dialect_name(autogen_context) != 'postgresql':
        return {}

    ret = {}
    names = set([index.name for index in conn_table.indexes] +
                [constraint.name for constraint in conn_table.constraints])
    print("names", names)
    res = autogen_context.connection.execute(
        "SELECT indexname, indexdef from pg_indexes where tablename = '%s'" % conn_table.name)
    for row in res.fetchall():
        (
            name,
            details
        ) = row
        if name not in names:
            m = index_regex.match(details)
            if m is None:
                continue
            r = m.groups()
            # missing! TODO

            # need _reverse, how to know what to reverse?
            ret[name] = {
                'postgresql_using': r[1],
                'postgresql_using_internals': r[2],

            }
            print("missing!", name, details)

    return ret
