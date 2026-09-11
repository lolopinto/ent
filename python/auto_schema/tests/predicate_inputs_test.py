from pathlib import Path
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from auto_schema.runner import Runner

from .runner_test import (
    _assert_partial_index_change, _partial_index_metadata, _reflected_predicate,
)


def _metadata(predicate, **kwargs):
    metadata = _partial_index_metadata(None, **kwargs)
    table = metadata.tables["contacts"]
    index = next(iter(table.indexes))
    value = predicate(table) if callable(predicate) else predicate
    index.kwargs.update(postgresql_where=value, sqlite_where=value)
    return metadata


def _assert_excluded_index_unchanged(new_test_runner, filter_kind, change, *, full_text=False):
    before = _partial_index_metadata("status = 'active'", full_text=full_text)
    r = new_test_runner(before)
    r.run()
    connection = r.get_connection()
    if connection.dialect.name == "postgresql":
        index_state = sa.text(
            "SELECT indexrelid, pg_get_indexdef(indexrelid) FROM pg_index "
            "WHERE indexrelid = 'contacts_active_idx'::regclass"
        )
    else:
        index_state = sa.text(
            "SELECT rootpage, sql FROM sqlite_master WHERE type = 'index' "
            "AND name = 'contacts_active_idx'"
        )
    original = connection.execute(index_state).one()
    connection.commit()
    predicate = "status =" if change == "invalid_predicate" else "status = 'inactive'"
    after = _partial_index_metadata(predicate, full_text=full_text)
    index = next(iter(after.tables["contacts"].indexes))
    index.info["unmanaged"] = True
    if change == "predicate_and_options":
        if full_text:
            index.info["postgresql_using"] = "gist"
        else:
            index.unique = True
    r2 = new_test_runner(after, r)
    files = {path: path.read_bytes() for path in Path(r2.get_schema_path()).rglob("*.py")}
    include_object = Runner.include_object
    compared = []

    def objects(object_, name, type_, reflected, compare_to):
        if type_ == "index" and name == index.name:
            if not reflected and compare_to is not None:
                # Changed-index callbacks receive the metadata index and its
                # reflected counterpart, just like Alembic's own comparator.
                assert object_ is index
                assert compare_to.name == index.name
                assert compare_to.table.name == "contacts"
                compared.append(compare_to)
            if filter_kind == "name" or object_.info.get("unmanaged"):
                return False
        return include_object(object_, name, type_, reflected, compare_to)

    with patch.object(Runner, "include_object", side_effect=objects):
        assert r2.compute_changes() == []
        assert r2.run() is None
    assert compared
    assert connection.execute(index_state).one() == original
    assert {path: path.read_bytes() for path in Path(r2.get_schema_path()).rglob("*.py")} == files
    # Removing the filter still exposes the declared change. Invalid PostgreSQL
    # predicates must fail validation only after the caller opts into managing it.
    if change == "invalid_predicate" and connection.dialect.name == "postgresql":
        with pytest.raises(sa.exc.ProgrammingError):
            r2.compute_changes()
    else:
        assert r2.compute_changes()


class PredicateInputCases:
    @pytest.mark.parametrize("filter_kind", ["name", "metadata_info"])
    @pytest.mark.parametrize("change", ["predicate", "predicate_and_options", "invalid_predicate"])
    def test_excluded_index_is_not_compared_or_replaced(self, new_test_runner, filter_kind, change):
        _assert_excluded_index_unchanged(new_test_runner, filter_kind, change)

    @pytest.mark.parametrize("combined_change", [False, True])
    @pytest.mark.parametrize("predicate", [
        lambda t: sa.text("status = 'two%'"),
        lambda t: t.c.status == "two%",
        lambda t: t.c.score.is_(None),
        lambda t: sa.and_(t.c.score > 1, t.c.score < 10),
        lambda t: sa.false(),
    ], ids=["text", "equality", "is_null", "conjunction", "false"])
    def test_expression_predicate_replacement(self, new_test_runner, predicate, combined_change):
        options = {}
        if "Postgres" in type(self).__name__ and combined_change:
            options["postgresql_with"] = {"fillfactor": 80}
        r = _assert_partial_index_change(
            new_test_runner,
            _metadata(sa.text("status = 'one%'")),
            _metadata(predicate, unique=combined_change, **options),
        )
        assert "two%%" not in (_reflected_predicate(r) or "")
        if options:
            index = sa.inspect(r.engine).get_indexes("contacts")[0]
            assert index["dialect_options"]["postgresql_with"] == {"fillfactor": "80"}

    @pytest.mark.parametrize("before,after", [
        (None, sa.false()), (sa.false(), None), (sa.true(), sa.false()), (sa.false(), sa.true()),
    ])
    def test_boolean_expression_predicate_round_trip(self, new_test_runner, before, after):
        _assert_partial_index_change(new_test_runner, _metadata(before), _metadata(after))


class TestPostgresPredicateInputs(PredicateInputCases):
    @pytest.mark.parametrize("filter_kind", ["name", "metadata_info"])
    @pytest.mark.parametrize("change", ["predicate", "predicate_and_options", "invalid_predicate"])
    def test_excluded_full_text_index_is_not_compared_or_replaced(self, new_test_runner, filter_kind, change):
        _assert_excluded_index_unchanged(new_test_runner, filter_kind, change, full_text=True)

    @pytest.mark.parametrize("before,after", [(None, False), (False, None), (True, False), (False, True)])
    def test_native_boolean_predicate_round_trip(self, new_test_runner, before, after):
        _assert_partial_index_change(new_test_runner, _metadata(before), _metadata(after))

    @pytest.mark.parametrize("predicate", [
        lambda t: sa.text("status = 'one%'"), lambda t: t.c.status == "one%", lambda t: sa.false(),
    ], ids=["text", "expression", "false"])
    def test_generated_column_recreation_preserves_predicate(self, new_test_runner, predicate):
        def metadata(extra_column):
            result = _metadata(predicate)
            table = result.tables["contacts"]
            table.indexes.clear()
            table.append_column(sa.Column("label", sa.Text()))
            sql = "to_tsvector('english', status || ' ' || label)" if extra_column else "to_tsvector('english', status)"
            table.append_column(sa.Column("search", postgresql.TSVECTOR(), sa.Computed(sql)))
            sa.Index("contacts_active_idx", table.c.search, postgresql_using="gin", postgresql_where=predicate(table))
            return result

        before, after = metadata(False), metadata(True)
        r = new_test_runner(before)
        r.run()
        original_predicate = _reflected_predicate(r)
        r.get_connection().execute(sa.text(
            "INSERT INTO contacts (id, owner_id, status, label) VALUES (1, 1, 'one%', 'label')"
        ))
        r.get_connection().commit()
        r2 = new_test_runner(after, r)
        r2.run()
        assert _reflected_predicate(r2) == original_predicate
        assert r2.get_connection().execute(sa.text("SELECT search::text FROM contacts")).scalar_one() == "'label':2 'one':1"
        r2.get_connection().commit()
        assert r2.compute_changes() == []



class TestSqlitePredicateInputs(PredicateInputCases):
    @pytest.mark.parametrize("value", [True, False])
    def test_native_boolean_remains_unsupported_by_sqlite_ddl(self, new_test_runner, value):
        r = new_test_runner(_metadata(value))
        with pytest.raises(AttributeError, match="_compiler_dispatch"):
            r.metadata.create_all(r.connection)
