import alembic.operations.ops as alembicops
from alembic.autogenerate import renderers as alembic_renderers
from alembic.autogenerate.api import AutogenContext
from alembic.migration import MigrationContext
import sqlalchemy as sa

from auto_schema import ops
from auto_schema import renderers


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


def test_render_create_extension():
    op = ops.CreateExtensionOp(
        "vector",
        version="0.4.1",
        install_schema="public",
    )
    rendered = renderers.render_create_extension(None, op)
    assert rendered == "op.create_extension('vector', version='0.4.1', install_schema='public')"


def test_render_drop_extension():
    op = ops.DropExtensionOp(
        "uuid-ossp",
        drop_cascade=True,
    )
    rendered = renderers.render_drop_extension(None, op)
    assert rendered == "op.drop_extension('uuid-ossp', drop_cascade=True)"


def test_render_update_extension():
    op = ops.UpdateExtensionOp(
        "vector",
        from_version="0.4.1",
        to_version="0.5.0",
    )
    rendered = renderers.render_update_extension(None, op)
    assert rendered == "op.update_extension('vector', from_version='0.4.1', to_version='0.5.0')"
