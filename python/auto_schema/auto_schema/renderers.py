import uuid
from alembic.autogenerate import renderers
from alembic.autogenerate.api import AutogenContext
from sqlalchemy.dialects import postgresql
from . import ops
from . import util
import sqlalchemy as sa

# no need to put timestamps when rendering
_IGNORED_KEYS = ['created_at', 'updated_at']


@renderers.dispatch_for(ops.AddEdgesOp)
def render_add_edges(autogen_context: AutogenContext, op: ops.AddEdgesOp) -> str:
    return _render_edge_from_edges(op.edges, "op.add_edges")


@renderers.dispatch_for(ops.RemoveEdgesOp)
def render_remove_edges(autogen_context: AutogenContext, op: ops.RemoveEdgesOp) -> str:
    return _render_edge_from_edges(op.edges, "op.remove_edges")


@renderers.dispatch_for(ops.ModifyEdgeOp)
def render_modify_edge(autogen_context: AutogenContext, op: ops.ModifyEdgeOp) -> str:
    return (
        "op.modify_edge(\n"
        "'%(edge_type)s',\n"
        "%(edge)s\n"
        ")" % {
            "edge_type": op.edge_type,
            "edge": _render_edge(op.new_edge),
        }
    )


def _render_edge(edge):
    kv_pairs = []
    # get each line for each edge
    for k, v in edge.items():
        if k in _IGNORED_KEYS:
            continue

        # render as string so we don't deal with UUID missing
        if isinstance(v, postgresql.UUID) or isinstance(v, uuid.UUID):
            v = str(v)
        kv_pairs.append("'%s': %r" % (k, v))

    # get the rendering for an edge
    #     {"k": v, "k2": v2}
    return "{%s},\n" % ", ".join(kv_pairs)


def _render_edge_from_edges(edge_dicts, edge_fn_name):
    # build each edge
    edges = []
    for edge in edge_dicts:
        # append the code for each edge into list. we should end with something like:
        edges.append(
            _render_edge(edge)
        )

    # splice the edges to be rendered
    return (
        "%(edge_fn_name)s([\n"
        "%(edges)s"
        "])\n" % {
            "edge_fn_name": edge_fn_name,
            "edges": "".join(edges),
        }
    )


def _render_row_from_op(row_fn_name, table_name, pkeys, rows):
    rows = [_render_row(row) for row in rows]

    # splice the rows to be rendered
    return (
        "%(row_fn_name)s('%(table_name)s', %(pkeys)s, [\n"
        "%(rows)s"
        "])" % {
            "row_fn_name": row_fn_name,
            "table_name": table_name,
            "pkeys": util.render_list_csv_as_list(pkeys),
            "rows": "".join(rows),
        }
    )


def _render_row(row):
    kv_pairs = []
    # get each line for each row
    for k, v in row.items():
        kv_pairs.append("'%s': %r" % (k, v))

    # get the rendering for a row
    #     {"k": v, "k2": v2}
    return "{%s},\n" % ", ".join(kv_pairs)


@renderers.dispatch_for(ops.AddRowsOp)
def render_add_edges(autogen_context: AutogenContext, op: ops.AddRowsOp) -> str:
    return _render_row_from_op("op.add_rows", op.table_name, op.pkeys, op.rows)


@renderers.dispatch_for(ops.RemoveRowsOp)
def render_remove_edges(autogen_context: AutogenContext, op: ops.RemoveRowsOp) -> str:
    return _render_row_from_op("op.remove_rows", op.table_name, op.pkeys, op.rows)


@renderers.dispatch_for(ops.ModifyRowsOp)
def render_modify_rows(autogen_context: AutogenContext, op: ops.ModifyRowsOp) -> str:
    rows = [_render_row(row) for row in op.rows]
    old_rows = [_render_row(row) for row in op.old_rows]

    return (
        "op.modify_rows('%(table_name)s', %(pkeys)s, [\n"
        "%(rows)s],"
        "[\n%(old_rows)s"
        "])" % {
            "table_name": op.table_name,
            "pkeys": util.render_list_csv_as_list(op.pkeys),
            "rows": "".join(rows),
            "old_rows": "".join(old_rows),
        }
    )


@renderers.dispatch_for(ops.AlterEnumOp)
def render_alter_enum(autogen_context: AutogenContext, op: ops.AlterEnumOp) -> str:
    if op.before is None:
        return (
            # manual indentation
            "with op.get_context().autocommit_block():\n"
            "    op.alter_enum('%(enum_name)s', '%(value)s')" % {
                "enum_name": op.enum_name,
                "value": op.value,
            }
        )
    else:
        return (
            # manual indentation
            "with op.get_context().autocommit_block():\n"
            "    op.alter_enum('%(enum_name)s', '%(value)s', before='%(before)s')" % {
                "enum_name": op.enum_name,
                "value": op.value,
                "before": op.before,
            }
        )


@renderers.dispatch_for(ops.NoDowngradeOp)
def render_no_downgrade_op(autogen_context: AutogenContext, op: ops.NoDowngradeOp) -> str:
    return "raise ValueError('operation is not reversible')"


@renderers.dispatch_for(ops.AddEnumOp)
def render_add_enum_op(autogen_context: AutogenContext, op: ops.AddEnumOp) -> str:
    return "op.add_enum_type('%s', [%s])" % (op.enum_name, util.render_list_csv(op.values))


@renderers.dispatch_for(ops.DropEnumOp)
def render_drop_enum_op(autogen_context: AutogenContext, op: ops.DropEnumOp) -> str:
    return "op.drop_enum_type('%s', [%s])" % (op.enum_name, util.render_list_csv(op.values))


# hmm not sure why we need this. there's probably an easier way to do this that doesn't require this...
@renderers.dispatch_for(ops.OurCreateCheckConstraintOp)
def render_check_constraint(autogen_context: AutogenContext, op: ops.OurCreateCheckConstraintOp) -> str:
    return "op.create_check_constraint('%s', '%s', '%s')" % (op.constraint_name, op.table_name, op.condition)


def _render_kw_args(d):
    kv_pairs = []
    for k, v in d.items():
        kv_pairs.append("%s=%r" % (k, v))

    return ", ".join(kv_pairs)


@renderers.dispatch_for(ops.CreateFullTextIndexOp)
def render_full_text_index(autogen_context: AutogenContext, op: ops.CreateFullTextIndexOp) -> str:

    return (
        "op.create_full_text_index('%(index_name)s', '%(table_name)s', "
        "unique=%(unique)r, %(kwargs)s)" % {
            "index_name": op.index_name,
            "table_name": op.table_name,
            "unique": op.unique or False,
            "kwargs": _render_kw_args(op.kw),
        }
    )


@renderers.dispatch_for(ops.DropFullTextIndexOp)
def render_drop_full_text_index(autogen_context: AutogenContext, op: ops.DropFullTextIndexOp) -> str:
    return (
        "op.drop_full_text_index('%(index_name)s', '%(table_name)s', "
        "%(kwargs)s)" % {
            "index_name": op.index_name,
            "table_name": op.table_name,
            "kwargs": _render_kw_args(op.kw),
        }
    )
