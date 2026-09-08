import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

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


class PredicateInputCases:
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
