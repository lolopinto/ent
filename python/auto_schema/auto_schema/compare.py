from alembic.autogenerate import comparators
from . import ops
from alembic.operations import Operations, MigrateOperation
import sqlalchemy as sa
import pprint

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
  return ops.ModifyEdgeOp(
    meta_edge['edge_type'],
    meta_edge,
    db_edge,
    schema=sch
  )


@comparators.dispatch_for("schema")
def compare_enum(autogen_context, upgrade_ops, schemas):
  inspector = autogen_context.inspector

  db_metadata = sa.MetaData()
  db_metadata.reflect(inspector.bind)

 # TODO schema not being used
  for sch in schemas:
    conn_tables = { table.name: table for table in db_metadata.sorted_tables}
    metadata_tables = {table.name: table for table in autogen_context.metadata.sorted_tables}


    # trying to detect change in tables
    for name in conn_tables:
      if not name in metadata_tables:
        continue

      metadata_table = metadata_tables[name]
      conn_table = conn_tables[name]

      conn_columns = {col.name: col for col in conn_table.columns}
      metadata_columns = {col.name: col for col in metadata_table.columns}

      for name in conn_columns:
        if not name in metadata_columns:
          continue
        metadata_column = metadata_columns[name]
        conn_column = conn_columns[name]
        _compare_enum(upgrade_ops, conn_column, metadata_column, sch)


def _compare_enum(upgrade_ops, conn_column, metadata_column, sch):
  conn_type = conn_column.type
  metadata_type = metadata_column.type

  # not enums, bye
  if not isinstance(conn_type, sa.Enum) or not isinstance(metadata_type, sa.Enum):
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
          ops.AlterEnumOp(conn_type.name, value, schema=sch, before=metadata_type.enums[index + 1])
        )
      else:
        upgrade_ops.ops.append(
          ops.AlterEnumOp(conn_type.name, value, schema=sch)
        )


