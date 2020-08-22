from alembic.operations import Operations, MigrateOperation
import datetime
import sqlalchemy as sa

from . import ops

def add_edges_from(connection, edges):
  t = datetime.datetime.now()
  table = _get_table(connection)

  edges_to_write = []
  for edge in edges:
    edge['created_at'] = t
    edge['updated_at'] = t
    edges_to_write.append(edge)

  connection.execute(
    table.insert().values(edges_to_write)
  )


@Operations.implementation_for(ops.AddEdgesOp)
def add_edges(operations, operation):
  connection = operations.get_bind()
  add_edges_from(connection, operation.edges)


@Operations.implementation_for(ops.RemoveEdgesOp)
def drop_edge(operations, operation):
  edge_types = [edge['edge_type'] for edge in operation.edges]

  connection = operations.get_bind()
  table = _get_table(connection)
  connection.execute(
    table.delete().where(table.c.edge_type.in_(edge_types))
  )


@Operations.implementation_for(ops.ModifyEdgeOp)
def modify_edge(operations, operation):
  connection = operations.get_bind()
  table = _get_table(connection)
  t = datetime.datetime.now()

  edge = operation.new_edge

  print(operation.edge_type)
  print(edge)
  connection.execute(
    table.update().where(table.c.edge_type == operation.edge_type).values(edge)
  )


def _get_table(connection):
  # todo there has to be a better way to do this instead of reflecting again
  metadata = sa.MetaData()
  metadata.reflect(connection)

  return metadata.tables['assoc_edge_config']


@Operations.implementation_for(ops.AlterEnumOp)
def alter_enum(operations, operation):
  print('implementation')
  connection = operations.get_bind()
  connection.execute(
    "ALTER TYPE %s ADD VALUE '%s'" %(operation.enum_name, operation.value)
  )

