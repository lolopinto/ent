from alembic.autogenerate import renderers
from auto_schema import edge_op

# no need to put timestamps when rendering
_IGNORED_KEYS = ['created_at', 'updated_at']

@renderers.dispatch_for(edge_op.AddEdgesOp)
def render_add_edges(autogen_context, op):
  return _render_edge_from_edges(op.edges, "op.add_edges")


@renderers.dispatch_for(edge_op.RemoveEdgesOp)
def render_remove_edges(autogen_context, op):
  return _render_edge_from_edges(op.edges, "op.remove_edges")


@renderers.dispatch_for(edge_op.ModifyEdgeOp)
def render_modify_edge(autogen_context, op):
  return (
    "op.modify_edge(\n"
    "%(indent)s'%(edge_type)s',\n"
    "%(indent)s%(edge)s\n"
    ")" % {
      "indent": "  ",
      "edge_type": op.edge_type,
      "edge": _render_edge(op.new_edge),
    }
  )


def _render_edge(edge, indent="  "):
  kv_pairs = []
  # get each line for each edge
  for k, v in edge.items():
    if k in _IGNORED_KEYS:
      continue

    kv_pairs.append("'%s': %r" % (k, v))

  # get the rendering for an edge
  #     {"k": v, "k2": v2}
  return "%(indent)s{%(edge)s},\n" % {
    "indent": indent,
    "edge": ", ".join(kv_pairs),
  }


def _render_edge_from_edges(edge_dicts, edge_fn_name):
  # build each edge
  edges = []
  for edge in edge_dicts:
    # append the code for each edge into list. we should end with something like:
    edges.append(
      # indent 4 spaces instead of 2
      _render_edge(edge, indent="    ") 
    )

  
  # splice the edges to be rendered
  return (
    "%(edge_fn_name)s(\n"
    "%(indent)s[\n"
    "%(edges)s"
    "%(indent)s]\n"
    ")" % {
      "edge_fn_name": edge_fn_name,
      "indent": "  ",
      "edges": "".join(edges),
    }
  )

