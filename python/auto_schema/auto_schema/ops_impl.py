import uuid
from alembic.operations import Operations, MigrateOperation
import datetime
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.sql.schema import Table
from sqlalchemy.sql.sqltypes import String

from . import ops


def add_edges_from(connection: sa.engine.Connection, edges):
    t = datetime.datetime.now()
    table = _get_table(connection)

    edges_to_write = []
    for edge in edges:
        edge['created_at'] = t
        edge['updated_at'] = t
        if isinstance(edge['edge_type'], postgresql.UUID) or isinstance(edge['edge_type'], uuid.UUID):
            edge['edge_type'] = str(edge['edge_type'])
        edges_to_write.append(edge)

    dialect = connection.dialect.name
    if dialect == 'sqlite':
        stmt = table.insert().values(
            edges_to_write)
    else:
        stmt = postgresql.insert(table).values(
            edges_to_write).on_conflict_do_nothing()

    connection.execute(stmt)


@ Operations.implementation_for(ops.AddEdgesOp)
def add_edges(operations: ops.Operations, operation: ops.AddEdgesOp):
    connection = operations.get_bind()
    add_edges_from(connection, operation.edges)


@ Operations.implementation_for(ops.RemoveEdgesOp)
def drop_edge(operations: ops.Operations, operation: ops.RemoveEdgesOp):
    edge_types = [edge['edge_type'] for edge in operation.edges]

    connection = operations.get_bind()
    table = _get_table(connection)
    connection.execute(
        table.delete().where(table.c.edge_type.in_(edge_types))
    )


@ Operations.implementation_for(ops.ModifyEdgeOp)
def modify_edge(operations: ops.Operations, operation: ops.ModifyEdgeOp):
    connection = operations.get_bind()
    table = _get_table(connection)
    t = datetime.datetime.now()

    edge = operation.new_edge

    connection.execute(
        table.update().where(table.c.edge_type == operation.edge_type).values(edge)
    )


def _get_table(connection: sa.engine.Connection, name: String = 'assoc_edge_config'):
    # todo there has to be a better way to do this instead of reflecting again
    metadata = sa.MetaData()
    metadata.reflect(connection)

    return metadata.tables[name]


@ Operations.implementation_for(ops.AddRowsOp)
def add_rows(operations: ops.Operations, operation: ops.AddRowsOp):
    connection = operations.get_bind()
    table = _get_table(connection, name=operation.table_name)

    connection.execute(
        table.insert().values(operation.rows)
    )


@ Operations.implementation_for(ops.RemoveRowsOp)
def remove_rows(operations: ops.Operations, operation: ops.RemoveRowsOp):
    connection = operations.get_bind()
    table = _get_table(connection, name=operation.table_name)
    if len(operation.pkeys) == 1:
        key = operation.pkeys[0]
        keys = [row[key] for row in operation.rows]
        connection.execute(
            table.delete().where(table.c[key].in_(keys))
        )
    else:
        # multiple clauses. send a sql statement for each row
        for row in operation.rows:
            clauses = [table.c[key] == row[key] for key in operation.pkeys]
            connection.execute(
                table.delete().where(sa.sql.expression.and_(*clauses))
            )


@Operations.implementation_for(ops.ModifyRowsOp)
def modify_rows(operations: ops.Operations, operation: ops.ModifyRowsOp):
    connection = operations.get_bind()
    table = _get_table(connection, operation.table_name)

    if len(operation.pkeys) == 1:
        key = operation.pkeys[0]
        for row in operation.rows:
            connection.execute(
                table.update().where(table.c[key] == row[key]).values(row)
            )
    else:
        for row in operation.rows:
            clauses = [table.c[key] == row[key] for key in operation.pkeys]
            connection.execute(
                table.update().where(sa.sql.expression.and_(*clauses)).values(row)
            )


@Operations.implementation_for(ops.AlterEnumOp)
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


@Operations.implementation_for(ops.AddEnumOp)
def add_enum_type(operations: ops.Operations, operation: ops.AddEnumOp):
    postgresql.ENUM(*operation.values, name=operation.enum_name).create(
        operations.get_bind())


@Operations.implementation_for(ops.DropEnumOp)
def drop_enum_type(operations: ops.Operations, operation: ops.DropEnumOp):
    postgresql.ENUM(*operation.values, name=operation.enum_name).drop(
        operations.get_bind())
