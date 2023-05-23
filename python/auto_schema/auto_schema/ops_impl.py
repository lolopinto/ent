from typing import Any, List, Union

from . import ops
import uuid
from alembic.operations import Operations, MigrateOperation
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql.schema import Table
from sqlalchemy.sql.sqltypes import String
from auto_schema import config


# TODO sql_compiler SQLCompiler

# for scenarios where we just want to return exactly what was passed
# specific strings and don't need %r
# sa.sql.quoted_name may or may not do the same thing
class exact(object):

    def __init__(self, val) -> None:
        self.val = val


def _sql_version(val):
    # for sql mode, need to convert to values that can run from sql script
    if val is None:
        return 'NULL'
    if val is True:
        return 'true'
    if val is False:
        return 'false'
    if isinstance(val, exact):
        return val.val
    return "%r" % val


# need to use manual insert statement because of sql mode
def _exec_insert_statement(
    operations: ops.Operations,
    table: sa.Table,
    data: Union[List[dict], dict],
    modify_fn=None,
    on_conflict_do_nothing=False,
):
    if not isinstance(data, list):
        data = [data]

    keys_init = False
    keys = []
    values = []
    for d in data:
        if modify_fn is not None:
            d = modify_fn(d)

        curr_values = []
        for k, v in d.items():
            # only need to do keys once
            if not keys_init:
                keys.append(k)
            curr_values.append(_sql_version(v))

        keys_init = True
        values.append("(%s)" % ", ".join(curr_values))

    stmt = "INSERT INTO %s(%s) VALUES%s" % (
        table.name, ", ".join(keys), ",\n".join(values))

    connection = operations.get_bind()
    dialect = connection.dialect.name

    if on_conflict_do_nothing is True and dialect == 'postgresql':
        stmt += " ON CONFLICT DO NOTHING"

    connection.execute(stmt)


def date(operations: ops.Operations):
    connection = operations.get_bind()
    dialect = connection.dialect.name
    if dialect == 'postgresql':
        return exact("now() AT TIME ZONE 'UTC'")
    else:
        return exact('datetime()')


def _exec_delete_statement(operations: ops.Operations,
                           table: sa.Table,
                           pkeys: List[str],
                           data: List[Any],
                           ):

    connection = operations.get_bind()

    if len(pkeys) == 1:
        pkey = pkeys[0]
        keys = [row[pkey] for row in data]
        if len(keys) == 1:
            stmt = 'DELETE FROM %s WHERE %s = %s' % (
                table.name, pkey, _sql_version(keys[0]))
        else:
            stmt = 'DELETE FROM %s WHERE %s IN (%s)' % (table.name, pkey, ", ".join(
                [_sql_version(key) for key in keys]))

        connection.execute(
            stmt,
        )

    else:
        # multiple clauses. send a sql statement for each row
        for row in data:
            clauses = []
            for pkey in pkeys:
                clauses.append('%s = %s' % (pkey, _sql_version(row[pkey])))

            stmt = 'DELETE FROM %s WHERE %s ' % (
                table.name, ' AND '.join(clauses))
            connection.execute(stmt)


def _exec_update_statement(operations: ops.Operations,
                           table: sa.Table,
                           pkeys: List[str],
                           data: List[Any],
                           ):
    connection = operations.get_bind()

    for row in data:
        clauses = []
        values = []
        for pkey in pkeys:
            clauses.append('%s = %s' % (pkey, _sql_version(row[pkey])))

        for k, v in row.items():
            values.append('%s = %s' % (k, _sql_version(v)))

        stmt = 'UPDATE %s SET %s WHERE %s' % (
            table.name, ", ".join(values), ' AND '.join(clauses))

        connection.execute(
            stmt,
        )


def add_edges_from(operations: ops.Operations, edges):
    table = _get_table(operations)

    def modify_edge(edge):
        d = date(operations)
        edge['created_at'] = d
        edge['updated_at'] = d
        if isinstance(edge['edge_type'], postgresql.UUID) or isinstance(edge['edge_type'], uuid.UUID):
            edge['edge_type'] = str(edge['edge_type'])
        return edge

    _exec_insert_statement(operations, table, edges,
                           modify_edge, on_conflict_do_nothing=True)


@ Operations.implementation_for(ops.AddEdgesOp)
def add_edges(operations: ops.Operations, operation: ops.AddEdgesOp):
    add_edges_from(operations, operation.edges)


@ Operations.implementation_for(ops.RemoveEdgesOp)
def drop_edge(operations: ops.Operations, operation: ops.RemoveEdgesOp):
    table = _get_table(operations)
    _exec_delete_statement(operations, table, ['edge_type'], operation.edges)


@ Operations.implementation_for(ops.ModifyEdgeOp)
def modify_edge(operations: ops.Operations, operation: ops.ModifyEdgeOp):
    table = _get_table(operations)

    edge = operation.new_edge
    edge['updated_at'] = date(operations)

    _exec_update_statement(operations, table, ['edge_type'], [edge])


def _get_table(operations: ops.Operations, name: String = 'assoc_edge_config') -> sa.Table:
    table = None
    if config.metadata is not None:
        tables = [t for t in config.metadata.sorted_tables if t.name == name]
        if len(tables) == 1:
            return tables[0]

    table = operations.schema_obj.table(name)
    assert table is not None
    return table


@ Operations.implementation_for(ops.AddRowsOp)
def add_rows(operations: ops.Operations, operation: ops.AddRowsOp):
    table = _get_table(operations, name=operation.table_name)

    _exec_insert_statement(operations, table, operation.rows)


@ Operations.implementation_for(ops.RemoveRowsOp)
def remove_rows(operations: ops.Operations, operation: ops.RemoveRowsOp):
    table = _get_table(operations, name=operation.table_name)
    _exec_delete_statement(operations, table, operation.pkeys, operation.rows)


@ Operations.implementation_for(ops.ModifyRowsOp)
def modify_rows(operations: ops.Operations, operation: ops.ModifyRowsOp):
    table = _get_table(operations, operation.table_name)

    _exec_update_statement(operations, table, operation.pkeys, operation.rows)


@ Operations.implementation_for(ops.AlterEnumOp)
def alter_enum(operations: ops.Operations, operation: ops.AlterEnumOp):
    connection = operations.get_bind()
    if operation.before is None:
        connection.execute(
            "ALTER TYPE %s ADD VALUE '%s'" % (
                operation.enum_name, operation.value)
        )
    else:
        connection.execute(
            "ALTER TYPE %s ADD VALUE '%s' BEFORE '%s'" % (
                operation.enum_name, operation.value, operation.before)
        )


@ Operations.implementation_for(ops.AddEnumOp)
def add_enum_type(operations: ops.Operations, operation: ops.AddEnumOp):
    stmt = 'CREATE TYPE %s AS ENUM (%s)' % (
        operation.enum_name, ', '.join([_sql_version(v) for v in operation.values]))
    connection = operations.get_bind()
    connection.execute(stmt)


@ Operations.implementation_for(ops.DropEnumOp)
def drop_enum_type(operations: ops.Operations, operation: ops.DropEnumOp):
    stmt = 'DROP TYPE %s' % operation.enum_name
    connection = operations.get_bind()
    connection.execute(stmt)


@ Operations.implementation_for(ops.CreateFullTextIndexOp)
def create_full_text_index(operations: ops.Operations, operation: ops.CreateFullTextIndexOp):
    connection = operations.get_bind()
    connection.execute(
        "CREATE INDEX %(index_name)s ON %(table_name)s USING %(using)s (%(using_internals)s)" % {
            'index_name': operation.index_name,
            'table_name': operation.table_name,
            'using': operation.kw.get('info').get('postgresql_using'),
            # TODO should this work if empty?
            'using_internals': operation.kw.get('info').get('postgresql_using_internals'),
        }
    )


@ Operations.implementation_for(ops.DropFullTextIndexOp)
def create_full_text_index(operations: ops.Operations, operation: ops.DropFullTextIndexOp):
    connection = operations.get_bind()
    connection.execute(
        "DROP INDEX %s" % operation.index_name
    )
