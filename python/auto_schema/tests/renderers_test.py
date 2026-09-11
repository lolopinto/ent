import alembic.operations.ops as alembicops
from alembic.autogenerate import renderers as alembic_renderers
from alembic.autogenerate.api import AutogenContext
from alembic.migration import MigrationContext
from alembic.operations import Operations
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from unittest.mock import MagicMock
import pytest

from auto_schema import ops
from auto_schema import renderers
from auto_schema import runner
from auto_schema import schema_item


def _make_autogen_context():
    engine = sa.create_engine("sqlite://")
    connection = engine.connect()
    mc = MigrationContext.configure(
        connection=connection,
        opts={
            "alembic_module_prefix": "op.",
            "sqlalchemy_module_prefix": "sa.",
            "user_module_prefix": None,
            "render_as_batch": False,
        },
    )
    return AutogenContext(mc), connection, engine


def test_render_create_index_concurrently():
    op = alembicops.CreateIndexOp(
        "accounts_email_idx",
        "accounts",
        ["email"],
        postgresql_using="btree",
        postgresql_concurrently=True,
    )
    render_fn = alembic_renderers._registry[(alembicops.CreateIndexOp, "default")]
    autogen_context, connection, engine = _make_autogen_context()
    try:
        rendered = render_fn(autogen_context, op)
    finally:
        connection.close()
        engine.dispose()
    assert "with op.get_context().autocommit_block()" in rendered
    assert "op.create_index" in rendered
    assert "accounts_email_idx" in rendered
    assert "accounts" in rendered
    assert "postgresql_concurrently=True" in rendered


def test_render_drop_index_concurrently():
    op = alembicops.DropIndexOp(
        "accounts_email_idx",
        "accounts",
        postgresql_concurrently=True,
    )
    render_fn = alembic_renderers._registry[(alembicops.DropIndexOp, "default")]
    autogen_context, connection, engine = _make_autogen_context()
    try:
        rendered = render_fn(autogen_context, op)
    finally:
        connection.close()
        engine.dispose()
    assert "with op.get_context().autocommit_block()" in rendered
    assert "op.drop_index" in rendered
    assert "accounts_email_idx" in rendered
    assert "table_name" in rendered
    assert "postgresql_concurrently=True" in rendered


@pytest.mark.parametrize("paramstyle", ["pyformat", "format"])
@pytest.mark.parametrize("concurrently", [False, True])
@pytest.mark.parametrize("drop", [False, True])
def test_postgres_index_source_preserves_percent_and_live_context(paramstyle, concurrently, drop):
    dialect = postgresql.dialect(paramstyle=paramstyle)
    mc = MigrationContext.configure(dialect=dialect, opts={
        "alembic_module_prefix": "op.", "sqlalchemy_module_prefix": "sa.",
        "user_module_prefix": None, "render_as_batch": False,
    })
    context = AutogenContext(mc)
    table = sa.Table("accounts", sa.MetaData(), sa.Column("status", sa.Text()), schema="tenant%prod")
    predicate = sa.text("status LIKE '50%_done' AND status <> '100%'")
    index = sa.Index(
        "accounts_%_idx", table.c.status, postgresql_where=predicate,
        postgresql_concurrently=concurrently,
    )
    operation = (alembicops.DropIndexOp if drop else alembicops.CreateIndexOp).from_index(index)
    live_impl = mc.impl
    live_preparer = dialect.identifier_preparer
    live_sql = str(predicate.compile(dialect=dialect))
    assert "50%%_done" in live_sql
    render_fn = alembic_renderers._registry[(type(operation), "default")]
    for _ in range(2):
        rendered = render_fn(context, operation)
        assert "50%_done" in rendered
        assert "50%%_done" not in rendered
        recorded = MagicMock()
        exec(rendered, {"op": recorded, "sa": sa})
        call = recorded.drop_index.call_args if drop else recorded.create_index.call_args
        assert str(call.kwargs["postgresql_where"]) == predicate.text
        assert call.args[0] == "accounts_%_idx"
        assert call.kwargs["schema"] == "tenant%prod"
        assert call.kwargs["postgresql_concurrently"] == concurrently
        assert recorded.get_context.called == concurrently
        assert context.migration_context is mc
        assert context.dialect is mc.dialect is live_impl.dialect is dialect
        assert mc.impl is live_impl
        assert dialect.identifier_preparer is live_preparer
        assert dialect.paramstyle == paramstyle
        assert str(predicate.compile(dialect=dialect)) == live_sql
        assert index.dialect_options["postgresql"]["where"] is predicate


class TestPostgresRendererContext:
    def test_rendered_index_executes_with_original_connection(self, new_test_runner):
        metadata = sa.MetaData()
        table = sa.Table("accounts", metadata, sa.Column("status", sa.Text()))
        r = new_test_runner(metadata)
        connection = r.connection
        table.create(connection)
        mc = MigrationContext.configure(connection=connection, opts={
            "alembic_module_prefix": "op.", "sqlalchemy_module_prefix": "sa.",
            "user_module_prefix": None, "render_as_batch": False,
        })
        context = AutogenContext(mc)
        dialect, impl = connection.dialect, mc.impl
        index = sa.Index("accounts_status_idx", table.c.status, postgresql_where=sa.text("status LIKE '50%'"))
        for operation in (alembicops.CreateIndexOp.from_index(index), alembicops.DropIndexOp.from_index(index)):
            render_fn = alembic_renderers._registry[(type(operation), "default")]
            rendered = render_fn(context, operation)
            assert context.connection is mc.connection is impl.connection is connection
            assert context.dialect is mc.dialect is impl.dialect is dialect
            assert mc.impl is impl
            exec(rendered, {"op": Operations(mc), "sa": sa})
            reflected = sa.inspect(connection).get_indexes("accounts")
            if isinstance(operation, alembicops.CreateIndexOp):
                assert reflected[0]["dialect_options"]["postgresql_where"] == "(status ~~ '50%'::text)"
            else:
                assert reflected == []
            assert connection.execute(sa.select(sa.literal("50%"))).scalar_one() == "50%"


def test_render_full_text_index_concurrently():
    op = ops.CreateFullTextIndexOp(
        "accounts_full_text_idx",
        "accounts",
        info={
            "postgresql_using": "gin",
            "postgresql_using_internals": "to_tsvector('english', first_name)",
            "postgresql_concurrently": True,
        },
    )
    rendered = renderers.render_full_text_index(None, op)
    assert "with op.get_context().autocommit_block()" in rendered
    assert "op.create_full_text_index" in rendered
    assert "accounts_full_text_idx" in rendered
    assert "postgresql_concurrently" in rendered


def test_render_create_db_extension():
    op = ops.CreateExtensionOp(
        {
            "name": "vector",
            "provisioned_by": "ent",
            "version": "0.4.1",
            "install_schema": "public",
            "runtime_schemas": ["public"],
            "drop_cascade": False,
        }
    )
    rendered = renderers.render_create_db_extension(None, op)
    assert "op.create_db_extension" in rendered
    assert "'name': 'vector'" in rendered
    assert "'runtime_schemas': ['public']" in rendered


def test_render_drop_db_extension():
    op = ops.DropExtensionOp(
        {
            "name": "vector",
            "provisioned_by": "ent",
            "version": None,
            "install_schema": None,
            "runtime_schemas": [],
            "drop_cascade": True,
        }
    )
    rendered = renderers.render_drop_db_extension(None, op)
    assert "op.drop_db_extension" in rendered
    assert "'drop_cascade': True" in rendered


def test_render_update_db_extension():
    op = ops.UpdateExtensionOp("vector", "0.4.0", "0.4.1")
    rendered = renderers.render_update_db_extension(None, op)
    assert rendered == "op.update_db_extension('vector', '0.4.0', '0.4.1')"


def test_render_set_db_extension_schema():
    op = ops.SetExtensionSchemaOp("hstore", "public", "extensions")
    rendered = renderers.render_set_db_extension_schema(None, op)
    assert (
        rendered
        == "op.set_db_extension_schema('hstore', 'public', 'extensions')"
    )


def test_render_custom_sqlalchemy_type():
    autogen_context, connection, engine = _make_autogen_context()
    try:
        rendered = runner.Runner.render_item(
            "type",
            schema_item.CustomSQLAlchemyType("point"),
            autogen_context,
        )
    finally:
        connection.close()
        engine.dispose()

    assert rendered == "auto_schema.schema_item.CustomSQLAlchemyType('point')"
