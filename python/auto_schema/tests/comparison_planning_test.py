from collections import Counter
from contextlib import contextmanager
from unittest.mock import Mock, patch
from alembic.autogenerate import produce_migrations

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from auto_schema import compare, ops
from .runner_test import _db_extension_metadata, _enum_partial_index_metadata, _partial_index_metadata


@contextmanager
def _discovery_queries(r):
    counts = Counter()

    def record(connection, cursor, statement, parameters, context, executemany):
        if "FROM pg_catalog.pg_extension AS ext" in statement:
            counts["extensions"] += 1
        if "WITH ORDINALITY AS declared_enum" in statement:
            counts["enums"] += 1
        if "CAST(%(enum_label)s AS" in statement:
            counts["enum_label_probes"] += 1
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


def _snapshot_connection():
    connection = Mock()
    connection.execute.side_effect = lambda query, *args: (
        [] if "pg_extension_update_paths" in str(query) else connection.execute.return_value
    )
    return connection


class TestPostgresComparisonPlanning:
    def test_snapshot_rejects_substitution_of_an_installed_extension(self):
        extension = compare._normalize_db_extension({"name": "example"})
        connection = _snapshot_connection()
        connection.execute.return_value = [("example", "1", "1", None)]
        with pytest.raises(ValueError, match='extension "Example" is not available'):
            compare._plan_snapshot_extension_ops(connection, [extension], {
                "Example": {"name": "Example", "version": "1"},
            })

    def test_snapshot_rejects_ambiguous_installed_identity(self):
        extension = compare._normalize_db_extension({"name": "EXAMPLE"})
        connection = _snapshot_connection()
        connection.execute.return_value = [("example", "1", "1", None)]
        with pytest.raises(ValueError, match='ambiguous db extension "EXAMPLE"'):
            compare._plan_snapshot_extension_ops(connection, [extension], {
                name: {"name": name, "version": "1"} for name in ("example", "Example")
            })

    @pytest.mark.parametrize("rows,version,installed,error", [
        ([], None, True, 'extension "example" is not available'),
        ([("example", "1", None, None)], None, False, 'version "1"'),
        ([("example", None, None, None)], None, False, 'default version'),
    ])
    def test_snapshot_requires_extension_dependency_metadata(self, rows, version, installed, error):
        extension = compare._normalize_db_extension({"name": "example", "version": version})
        connection = _snapshot_connection()
        connection.execute.return_value = rows
        existing = {"example": {"name": "example", "version": version or "1"}} if installed else {}
        with pytest.raises(ValueError, match=error) as exc:
            compare._plan_snapshot_extension_ops(connection, [extension], existing)
        assert "comparison PostgreSQL instance" in str(exc.value)
        assert "install" in str(exc.value)

    @pytest.mark.parametrize("names", [("leaf", "middle", "base"), ("middle", "base", "leaf")])
    def test_snapshot_orders_complete_dependency_chains_independently_of_declaration_order(self, names):
        extensions = [compare._normalize_db_extension({"name": name}) for name in names]
        connection = _snapshot_connection()
        connection.execute.return_value = [
            ("leaf", "1", "1", ["middle"]), ("middle", "1", "1", ["base"]),
            ("base", "1", "1", None),
        ]
        planned = compare._plan_snapshot_extension_ops(connection, extensions, {})
        assert [op.extension["name"] for op in planned] == ["base", "middle", "leaf"]

    def test_snapshot_accepts_explicit_version_without_a_default(self):
        extension = compare._normalize_db_extension({"name": "example", "version": "1"})
        connection = _snapshot_connection()
        connection.execute.return_value = [("example", None, "1", None)]
        planned = compare._plan_snapshot_extension_ops(connection, [extension], {})
        assert [op.extension for op in planned] == [extension]

    def test_snapshot_external_extensions_do_not_require_package_metadata(self):
        extension = compare._normalize_db_extension({"name": "example", "provisioned_by": "external"})
        connection = _snapshot_connection()
        assert compare._plan_snapshot_extension_ops(
            connection, [extension], {"example": {"name": "example", "version": "1"}},
        ) == []
        connection.execute.assert_not_called()

    def test_snapshot_siblings_keep_the_same_order_across_catalog_plans(self):
        names = ["child_z", "child_a", "Parent"]
        extensions = [compare._normalize_db_extension({"name": name}) for name in names]
        extensions[0]["version"] = "2"
        rows = [
            ("child_z", "1", "1", []),
            ("child_z", "1", "2", ["Parent"]),
            ("child_a", "1", "1", ["Parent"]),
            ("Parent", "1", "1", []),
            ("parent", "1", "1", []),
        ]
        connection = _snapshot_connection()
        for catalog_order in (rows, rows[::-1]):
            connection.execute.return_value = catalog_order
            planned = compare._plan_snapshot_extension_ops(connection, extensions, {})
            assert [op.extension["name"] for op in planned] == ["Parent", "child_z", "child_a"]

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

    @pytest.mark.parametrize("count", [1, 12])
    @pytest.mark.parametrize("declaration", ["indexed_table", "other_table", "new_table", "new_column"])
    def test_enum_discovery_is_once_per_run_and_fresh_after_upgrade(self, new_test_runner, count, declaration):
        def metadata(after):
            values = ["active", "archived"] if after else ["active"]
            if declaration == "indexed_table":
                predicate = "status = 'archived'" if after else "status = 'active'"
                result = _enum_partial_index_metadata(values, predicate, schema="public")
            else:
                predicate = "score > CASE WHEN 'archived'::other_status = 'active'::other_status THEN 2 ELSE 1 END" if after else "score > 0"
                result = _partial_index_metadata(predicate)
                if after or declaration != "new_table":
                    other = sa.Table("other", result, sa.Column("id", sa.Integer(), primary_key=True))
                    if after or declaration != "new_column":
                        other.append_column(sa.Column("status", postgresql.ENUM(
                            *values, name="other_status", schema="public", create_type=False,
                        )))
            return _more_indexes(result, predicate, count)

        before = metadata(False)
        r = new_test_runner(before)
        r.run()
        after = metadata(True)
        r2 = new_test_runner(after, r)
        context = r2._migration_context()
        for _ in range(2):
            with _discovery_queries(r2) as queries, patch.object(
                compare, "_plan_enum_changes", wraps=compare._plan_enum_changes,
            ) as discover:
                assert produce_migrations(context, after).upgrade_ops.ops
            assert queries["enums"] == 1
            assert queries["predicate_views"] == count  # Pending enums fail the first parse.
            assert queries["enum_label_probes"] == (1 if declaration in ("indexed_table", "other_table") else 0)
            assert discover.call_count == 1
        r2.run()
        with _discovery_queries(r2) as queries, patch.object(
            compare, "_plan_enum_changes", wraps=compare._plan_enum_changes,
        ) as discover:
            assert produce_migrations(context, after).upgrade_ops.ops == []
        assert queries["enums"] == 1
        assert queries["enum_label_probes"] == 0
        assert queries["predicate_views"] == count * 2
        assert discover.call_count == 1
