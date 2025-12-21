import uuid
from alembic.autogenerate import renderers
from alembic.autogenerate.api import AutogenContext
import alembic.operations.ops as alembicops
from sqlalchemy.dialects import postgresql
from . import ops
from . import csv
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
        f"op.modify_edge(\n"
        f"'{op.edge_type}',\n"
        f"{_render_edge(op.new_edge)}\n"
        ")"
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
        kv_pairs.append(f"'{k}': {v!r}")

    # get the rendering for an edge
    #     {"k": v, "k2": v2}
    return f"{{{', '.join(kv_pairs)}}},\n"


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
        f"{edge_fn_name}([\n"
        f"{''.join(edges)}"
        "])\n"
    )


def _render_row_from_op(row_fn_name, table_name, pkeys, rows):
    rows = [_render_row(row) for row in rows]

    # splice the rows to be rendered
    return (
        f"{row_fn_name}('{table_name}', {csv.render_list_csv_as_list(pkeys)}, [\n"
        f"{''.join(rows)}"
        "])"
    )


def _render_row(row):
    kv_pairs = []
    # get each line for each row
    for k, v in row.items():
        kv_pairs.append(f"'{k}': {v!r}")

    # get the rendering for a row
    #     {"k": v, "k2": v2}
    return f"{{{', '.join(kv_pairs)}}},\n"


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
        f"op.modify_rows('{op.table_name}', {csv.render_list_csv_as_list(op.pkeys)}, [\n"
        f"{''.join(rows)}],"
        f"[\n{''.join(old_rows)}"
        "])"
    )


@renderers.dispatch_for(ops.AlterEnumOp)
def render_alter_enum(autogen_context: AutogenContext, op: ops.AlterEnumOp) -> str:
    if (before := op.before) is None:
        return (
            # manual indentation
            f"with op.get_context().autocommit_block():\n"
            f"    op.alter_enum('{op.enum_name}', '{op.value}')" 
        )
    else:
        return (
            # manual indentation
            "with op.get_context().autocommit_block():\n"
            f"    op.alter_enum('{op.enum_name}', '{op.value}', before='{before}')" 
        )


@renderers.dispatch_for(ops.NoDowngradeOp)
def render_no_downgrade_op(autogen_context: AutogenContext, op: ops.NoDowngradeOp) -> str:
    return "raise ValueError('operation is not reversible')"


@renderers.dispatch_for(ops.AddEnumOp)
def render_add_enum_op(autogen_context: AutogenContext, op: ops.AddEnumOp) -> str:
    return f"op.add_enum_type('{op.enum_name}', [{csv.render_list_csv(op.values)}])"


@renderers.dispatch_for(ops.DropEnumOp)
def render_drop_enum_op(autogen_context: AutogenContext, op: ops.DropEnumOp) -> str:
    return f"op.drop_enum_type('{op.enum_name}', [{csv.render_list_csv(op.values)}])"


# hmm not sure why we need this. there's probably an easier way to do this that doesn't require this...
@renderers.dispatch_for(ops.OurCreateCheckConstraintOp)
def render_check_constraint(autogen_context: AutogenContext, op: ops.OurCreateCheckConstraintOp) -> str:
    return f"op.create_check_constraint('{op.constraint_name}', '{op.table_name}', '{op.condition}')"


def _render_kw_args(d):
    kv_pairs = []
    for k, v in d.items():
        kv_pairs.append(f"{k}={v!r}")

    return ", ".join(kv_pairs)


def _wrap_autocommit(op_text: str) -> str:
    indented = "\n".join([f"    {line}" for line in op_text.splitlines()])
    return (
        "with op.get_context().autocommit_block():\n"
        f"{indented}"
    )


def _get_index_kw(op) -> dict:
    if hasattr(op, "kw") and (kw := op.kw) is not None:
        return dict(kw)
    if hasattr(op, "kwargs") and (kwargs := op.kwargs) is not None:
        return dict(kwargs)
    return {}


def _render_index_kw(kw: dict) -> list[str]:
    items = []
    for key in sorted(kw.keys()):
        val = kw[key]
        if val is None or val is False:
            continue
        items.append(f"{key}={val!r}")
    return items


_orig_render_create_index = renderers._registry[(alembicops.CreateIndexOp, "default")]
_orig_render_drop_index = renderers._registry[(alembicops.DropIndexOp, "default")]


def _render_create_index_with_concurrently(
    autogen_context: AutogenContext, op
) -> str:
    rendered = _orig_render_create_index(autogen_context, op)
    if (kw := _get_index_kw(op)).get("postgresql_concurrently") is True:
        return _wrap_autocommit(rendered)
    return rendered


def _render_drop_index_with_concurrently(
    autogen_context: AutogenContext, op
) -> str:
    rendered = _orig_render_drop_index(autogen_context, op)
    if (kw := _get_index_kw(op)).get("postgresql_concurrently") is True:
        return _wrap_autocommit(rendered)
    return rendered


renderers._registry[(alembicops.CreateIndexOp, "default")] = _render_create_index_with_concurrently
renderers._registry[(alembicops.DropIndexOp, "default")] = _render_drop_index_with_concurrently

@renderers.dispatch_for(ops.CreateFullTextIndexOp)
def render_full_text_index(autogen_context: AutogenContext, op: ops.CreateFullTextIndexOp) -> str:
    op_text = (
        f"op.create_full_text_index('{op.index_name}', '{op.table_name}', "
        f"unique={op.unique or False!r}, {_render_kw_args(op.kw)})"
    )
    if (info := op.kw.get("info", {})).get("postgresql_concurrently") is True:
        return _wrap_autocommit(op_text)
    return op_text


@renderers.dispatch_for(ops.DropFullTextIndexOp)
def render_drop_full_text_index(autogen_context: AutogenContext, op: ops.DropFullTextIndexOp) -> str:
    op_text = (
        f"op.drop_full_text_index('{op.index_name}', '{op.table_name}', "
        f"{_render_kw_args(op.kw)})"
    )
    if (info := op.kw.get("info", {})).get("postgresql_concurrently") is True:
        return _wrap_autocommit(op_text)
    return op_text


# i don't think this is every used since the way it works is that this is called
@renderers.dispatch_for(ops.ExecuteSQL)
def render_execute_sql(autogen_context: AutogenContext, op: ops.ExecuteSQL) -> str:
    return (
        f'op.execute_sql("""{op.sql}""")' 
    )
