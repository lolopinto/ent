from alembic.autogenerate import renderers
from . import ops
from . import util

# no need to put timestamps when rendering
_IGNORED_KEYS = ['created_at', 'updated_at']


@renderers.dispatch_for(ops.AddEdgesOp)
def render_add_edges(autogen_context, op):
    return _render_edge_from_edges(op.edges, "op.add_edges")


@renderers.dispatch_for(ops.RemoveEdgesOp)
def render_remove_edges(autogen_context, op):
    return _render_edge_from_edges(op.edges, "op.remove_edges")


@renderers.dispatch_for(ops.ModifyEdgeOp)
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


def _render_row_from_op(row_fn_name, table_name, pkeys, rows):
    # indent 4 spaces instead of 2
    rows = [_render_row(row, indent="    ") for row in rows]

    # splice the rows to be rendered
    return (
        "%(row_fn_name)s('%(table_name)s', %(pkeys)s, \n"
        "%(indent)s[\n"
        "%(rows)s"
        "%(indent)s]\n"
        ")" % {
            "row_fn_name": row_fn_name,
            "table_name": table_name,
            "indent": "    ",
            "pkeys": util.render_list_csv_as_list(pkeys),
            "rows": "".join(rows),
        }
    )


def _render_row(row, indent="  "):
    kv_pairs = []
    # get each line for each edge
    for k, v in row.items():
        kv_pairs.append("'%s': %r" % (k, v))

    # get the rendering for a row
    #     {"k": v, "k2": v2}
    return "%(indent)s{%(row)s},\n" % {
        "indent": indent,
        "row": ", ".join(kv_pairs),
    }


@renderers.dispatch_for(ops.AddRowsOp)
def render_add_edges(autogen_context, op):
    return _render_row_from_op("op.add_rows", op.table_name, op.pkeys, op.rows)


@renderers.dispatch_for(ops.RemoveRowsOp)
def render_remove_edges(autogen_context, op):
    return _render_row_from_op("op.remove_rows", op.table_name, op.pkeys, op.rows)


@renderers.dispatch_for(ops.ModifyRowsOp)
def render_modify_rows(autogen_context, op):
    # indent 4 spaces instead of 2
    rows = [_render_row(row, indent="    ") for row in op.rows]
    # indent 4 spaces instead of 2
    old_rows = [_render_row(row, indent="    ") for row in op.old_rows]

    return (
        "op.modify_rows('%(table_name)s', %(pkeys)s, \n"
        "%(indent)s[\n"
        "%(rows)s],\n"
        "[\n%(old_rows)s],"
        "%(indent)s\n"
        ")" % {
            "indent": "  ",
            "table_name": op.table_name,
            "indent": "    ",
            "pkeys": util.render_list_csv_as_list(op.pkeys),
            "rows": "".join(rows),
            "old_rows": "".join(old_rows),
        }
    )


@renderers.dispatch_for(ops.AlterEnumOp)
def render_alter_enum(autogen_context, op):
    if op.before is None:
        return (
            "with op.get_context().autocommit_block():\n"
            "%(indent)sop.alter_enum('%(enum_name)s', '%(value)s')" % {
                "enum_name": op.enum_name,
                "value": op.value,
                "indent": "  ",
            }
        )
    else:
        return (
            "with op.get_context().autocommit_block():\n"
            "%(indent)sop.alter_enum('%(enum_name)s', '%(value)s', before='%(before)s')" % {
                "enum_name": op.enum_name,
                "value": op.value,
                "indent": "  ",
                "before": op.before,
            }
        )


@renderers.dispatch_for(ops.NoDowngradeOp)
def render_no_downgrade_op(autogen_context, op):
    return "raise ValueError('operation is not reversible')"


@renderers.dispatch_for(ops.AddEnumOp)
def render_add_enum_op(autogen_context, op):
    return "op.add_enum_type('%s', [%s])" % (op.enum_name, util.render_list_csv(op.values))


@renderers.dispatch_for(ops.DropEnumOp)
def render_drop_enum_op(autogen_context, op):
    return "op.drop_enum_type('%s', [%s])" % (op.enum_name, util.render_list_csv(op.values))
