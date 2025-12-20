import alembic.operations.ops as alembicops

from auto_schema import ops
from auto_schema import renderers


def test_render_create_index_concurrently():
    op = alembicops.CreateIndexOp(
        "accounts_email_idx",
        "accounts",
        ["email"],
        postgresql_using="btree",
        postgresql_concurrently=True,
    )
    rendered = renderers.render_create_index(None, op)
    assert rendered == (
        "with op.get_context().autocommit_block():\n"
        "    op.create_index('accounts_email_idx', 'accounts', ['email'], "
        "postgresql_concurrently=True, postgresql_using='btree')"
    )


def test_render_drop_index_concurrently():
    op = alembicops.DropIndexOp(
        "accounts_email_idx",
        "accounts",
        postgresql_concurrently=True,
    )
    rendered = renderers.render_drop_index(None, op)
    assert rendered == (
        "with op.get_context().autocommit_block():\n"
        "    op.drop_index('accounts_email_idx', table_name='accounts', "
        "postgresql_concurrently=True)"
    )


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
    assert rendered == (
        "with op.get_context().autocommit_block():\n"
        "    op.create_full_text_index('accounts_full_text_idx', 'accounts', "
        "unique=False, info={'postgresql_using': 'gin', "
        "'postgresql_using_internals': \"to_tsvector('english', first_name)\", "
        "'postgresql_concurrently': True})"
    )
