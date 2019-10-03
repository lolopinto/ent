from alembic.autogenerate import comparators
from auto_schema import edge_op

@comparators.dispatch_for("schema")
def compare_edges(autogen_context, upgrade_ops, schemas):
  db_edges = {}

  for sch in schemas:

    # so first check if the table exists. if it doesn't, nothing to do here 
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
  process_edges(
    metadata_edges, 
    db_edges, 
    upgrade_ops, 
    edge_op.AddEdgesOp,
    _meta_to_db_edge_mismatch,
  )

  # edges in db, but not in metadata, edges that need to be dropped
  process_edges(
    db_edges, 
    metadata_edges, 
    upgrade_ops, 
    edge_op.RemoveEdgesOp,
  )



def process_edges(source_edges, compare_edges, upgrade_ops, upgrade_op, edge_mismatch_fn=None):
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
        if compare_edge.get('inverse_edge_type', None) != edge.get('inverse_edge_type', None) and edge_mismatch_fn is not None:
          alter_op = edge_mismatch_fn(edge, compare_edge, sch)
          alter_ops.append(alter_op)
          pass

    
    if len(new_edges) > 0:
      upgrade_ops.ops.append(
        upgrade_op(new_edges, schema=sch)
      )

    # do any alter operation after the add/remove edge op
    [upgrade_ops.ops.append(alter_op) for alter_op in alter_ops]



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
    "SELECT to_regclass('%s') IS NOT NULL as exists" % ("assoc_edge_config")
  )
  res = row.first()
  return res['exists']


def _execute_sqlite_dialect(connection):
  row = connection.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='%s'" % ("assoc_edge_config")
  )
  res = row.first()
  return res is not None


def _get_schema_key(schema):
  if schema is None:
    return 'public'
  return schema


def _meta_to_db_edge_mismatch(meta_edge, db_edge, sch):
  return edge_op.ModifyEdgeOp(
    meta_edge['edge_type'],
    meta_edge,
    db_edge,
    schema=sch
  )