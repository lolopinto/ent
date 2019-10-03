from alembic.operations import Operations, MigrateOperation
import datetime
import sqlalchemy as sa

@Operations.register_operation("add_edges")
class AddEdgesOp(MigrateOperation):

  """Add one or more new edges."""

  def __init__(self, edges, schema=None):
    self.edges = edges
    self.schema = schema

  @classmethod
  def add_edges(cls, operations, edges, **kw):
    """Issue an "add edges" operation"""

    op = AddEdgesOp(edges, **kw)
    return operations.invoke(op)


  def reverse(self):
    return RemoveEdgesOp(self.edges, schema=self.schema)


  def get_revision_message(self):
    return _get_revision_message(self.edges, "add edge %s", "add edges %s")


@Operations.register_operation("remove_edges")
class RemoveEdgesOp(MigrateOperation):

  """Removes one or more existing edges."""

  def __init__(self, edges, schema=None):
    self.edges = edges
    self.schema = schema


  @classmethod
  def remove_edges(cls, operations, edges, **kw):
    """Issue a "remove edges" operation"""

    op = RemoveEdgesOp(edges, **kw)
    return operations.invoke(op)


  def reverse(self):
    return AddEdgesOp(self.edges, schema=self.schema)


  def get_revision_message(self):
    return _get_revision_message(self.edges, "remove edge %s", "remove edges %s")


@Operations.register_operation("modify_edge")
class ModifyEdgeOp(MigrateOperation):

  """Modify an existing edge"""

  def __init__(self, edge_type, new_edge, old_edge, schema=None):
    self.edge_type = edge_type
    self.new_edge = new_edge
    self.old_edge = old_edge
    self.schema = schema


  @classmethod
  def modify_edge(cls, operations, edge_type, new_edge, old_edge=None, **kw):
    """Issue a "modify edge" operation"""

    op = ModifyEdgeOp(edge_type, new_edge, old_edge, **kw)
    return operations.invoke(op)


  def reverse(self):
    return ModifyEdgeOp(self.edge_type, self.old_edge, self.new_edge, schema=self.schema)


  def get_revision_message(self):
    # assume name is not changing. if this is changing, this needs to be smarter
    return "modify edge %s" % (self.old_edge['edge_name'])



@Operations.implementation_for(AddEdgesOp)
def add_edges(operations, operation):
  t = datetime.datetime.now()
  connection = operations.get_bind()
  table = _get_table(connection)

  edges = []
  for edge in operation.edges:
    edge['created_at'] = t
    edge['updated_at'] = t
    edges.append(edge)

  connection.execute(
    table.insert().values(edges)
  )


@Operations.implementation_for(RemoveEdgesOp)
def drop_edge(operations, operation):
  edge_types = [edge['edge_type'] for edge in operation.edges]

  connection = operations.get_bind()
  table = _get_table(connection)
  connection.execute(
    table.delete().where(table.c.edge_type.in_(edge_types))
  )


@Operations.implementation_for(ModifyEdgeOp)
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


def _get_revision_message(edges, single_edge_msg, multi_edge_msg):
  if len(edges) == 1:
    return single_edge_msg % (edges[0]['edge_name'])

  edge_names = [edge['edge_name'] for edge in edges]
  return multi_edge_msg % (", ".join(sorted(edge_names)))
