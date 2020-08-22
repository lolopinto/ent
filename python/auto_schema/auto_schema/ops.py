from alembic.operations import Operations, MigrateOperation

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


def _get_revision_message(edges, single_edge_msg, multi_edge_msg):
  if len(edges) == 1:
    return single_edge_msg % (edges[0]['edge_name'])

  edge_names = [edge['edge_name'] for edge in edges]
  return multi_edge_msg % (", ".join(sorted(edge_names)))


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


@Operations.register_operation("alter_enum")
class AlterEnumOp(MigrateOperation):
  
  """Alters enum."""
  def __init__(self, enum_name, value, schema=None):
    self.enum_name = enum_name
    self.value = value


  @classmethod
  def alter_enum(cls, operations, enum_name, value, **kw):
    """Issues an "alter enum" operation"""

    op = AlterEnumOp(enum_name, value, *kw)
    return operations.invoke(op)

  
  def reverse(self):
    return NoDowngradeOp()


  def get_revision_message(self):
    return 'alter enum %s, add value %s' %(self.enum_name, self.value)


@Operations.register_operation("no_downgrade")
class NoDowngradeOp(MigrateOperation):
  @classmethod
  def no_downgrade(cls, operations, *kw):

    op = NoDowngradeOp(*kw)
    return operations.invoke(op)
  pass
