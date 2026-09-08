"""Compatibility adapters for the pinned Alembic renderer API.

Only index source rendering uses this context. Migration execution must retain
its original driver dialect and percent escaping. PostgreSQL renderer tests
exercise both paths and assert that the live object graph stays unchanged.
"""

import copy

from .clause_text import literal_sql_dialect


def index_render_context(autogen_context):
    # Alembic embeds compiled dialect options in sa.text() in Python source.
    # DBAPI escaping here would persist doubled '%' literals in the index and
    # double them again on each generated downgrade. Only copy this render
    # context; migration execution must keep the driver's original paramstyle.
    context = copy.copy(autogen_context)
    context.dialect = literal_sql_dialect(context.dialect)
    context.migration_context = copy.copy(context.migration_context)
    context.migration_context.dialect = context.dialect
    context.migration_context.impl = copy.copy(context.migration_context.impl)
    context.migration_context.impl.dialect = context.dialect
    return context

