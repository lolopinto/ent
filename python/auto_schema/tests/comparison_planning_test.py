from collections import Counter
from contextlib import contextmanager
from unittest.mock import patch
from alembic.autogenerate import produce_migrations

import pytest
import sqlalchemy as sa

from auto_schema import compare, ops
from .runner_test import _db_extension_metadata, _enum_partial_index_metadata, _partial_index_metadata


@contextmanager
def _discovery_queries(r):
    counts = Counter()

    def record(connection, cursor, statement, parameters, context, executemany):
        if "FROM pg_catalog.pg_extension AS ext" in statement:
            counts["extensions"] += 1
        if statement.startswith("SELECT pg_catalog.to_regtype("):
            counts["enum_identity"] += 1
        if statement.startswith("CREATE OR REPLACE TEMP VIEW ent_index_predicate_"):
            counts["predicate_views"] += 1

    sa.event.listen(r.engine, "before_cursor_execute", record)
    try:
        yield counts
    finally:
        sa.event.remove(r.engine, "before_cursor_execute", record)


def _more_indexes(metadata, predicate, count):
    table = metadata.tables["contacts"]
    for number in range(1, count):
        sa.Index(f"contacts_status_{number}_idx", table.c.owner_id, postgresql_where=sa.text(predicate))
    return metadata


class TestPostgresComparisonPlanning:
    @pytest.mark.parametrize("index_count", [1, 12])
    @pytest.mark.parametrize("install_extension", [False, True])
    def test_extension_discovery_is_once_per_run_and_fresh_after_upgrade(
        self, new_test_runner, index_count, install_extension,
    ):
        def metadata():
            return _more_indexes(_partial_index_metadata("status = 'active'"), "status = 'active'", index_count)

        r = new_test_runner(metadata())
        r.run()
        after = metadata()
        after.info.update(_db_extension_metadata(
            name="pg_trgm" if install_extension else "plpgsql",
            provisioned_by="ent" if install_extension else "external",
        ).info)
        r2 = new_test_runner(after, r)
        # Reuse one MigrationContext and connection across comparisons and the
        # upgrade. Each produce_migrations must get a fresh AutogenContext cache.
        context = r2._migration_context()
        for _ in range(2):
            with _discovery_queries(r2) as queries, patch.object(
                compare, "_get_extension_ops", wraps=compare._get_extension_ops,
            ) as plan:
                changes = produce_migrations(context, after).upgrade_ops.ops
            assert [type(op) for op in changes] == ([ops.CreateExtensionOp] if install_extension else [])
            assert queries["extensions"] == 1
            assert queries["predicate_views"] == index_count * 2
            assert plan.call_count == 1
        r2.run()
        with _discovery_queries(r2) as queries:
            assert produce_migrations(context, after).upgrade_ops.ops == []
        assert queries["extensions"] == 1
        assert queries["predicate_views"] == index_count * 2

    def test_enum_discovery_is_once_per_table_and_fresh_after_upgrade(self, new_test_runner):
        count = 12
        before = _more_indexes(_enum_partial_index_metadata(
            ["active"], "status = 'active'", schema="public",
        ), "status = 'active'", count)
        r = new_test_runner(before)
        r.run()
        after = _more_indexes(_enum_partial_index_metadata(
            ["active", "archived"], "status = 'archived'", schema="public",
        ), "status = 'archived'", count)
        r2 = new_test_runner(after, r)
        for _ in range(2):
            with _discovery_queries(r2) as queries, patch.object(
                compare, "_table_has_pending_enum_values", wraps=compare._table_has_pending_enum_values,
            ) as discover:
                assert r2.compute_changes()
            assert queries["enum_identity"] == 1
            assert queries["predicate_views"] == count  # New labels fail the first parse.
            assert discover.call_count == 1
        r2.run()
        with _discovery_queries(r2) as queries, patch.object(
            compare, "_table_has_pending_enum_values", wraps=compare._table_has_pending_enum_values,
        ) as discover:
            assert r2.compute_changes() == []
        assert queries["enum_identity"] == 0
        assert queries["predicate_views"] == count * 2
        assert discover.call_count == 1
