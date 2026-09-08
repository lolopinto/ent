import alembic.operations.ops as alembicops
import pytest
import sqlalchemy as sa

from .runner_test import _assert_no_predicate_views, _partial_index_metadata, _reflected_predicate


class TestPostgresPredicateDependencies:
    @pytest.mark.parametrize("full_text", [False, True])
    @pytest.mark.parametrize("predicate", [
        "status = 'active'",
        "lower(status) = 'active'",
        '"unrelated score" = \'score\' /* score */',
        "((FALSE::boolean))",
        "NULL",
    ], ids=["column", "function", "quoted_and_literal", "false", "null"])
    def test_unrelated_type_change_preserves_index(self, new_test_runner, full_text, predicate):
        def metadata(score_type):
            result = _partial_index_metadata(predicate, full_text=full_text)
            table = result.tables["contacts"]
            table.c.score.type = score_type
            table.append_column(sa.Column("unrelated score", sa.Text()))
            return result

        before, after = metadata(sa.String(32)), metadata(sa.Text())
        r = new_test_runner(before)
        r.run()
        r.get_connection().execute(before.tables["contacts"].insert(), {
            "id": 1, "owner_id": 10, "score": "score", "status": "active", "unrelated score": "score",
        })
        identity_sql = sa.text("SELECT 'contacts_active_idx'::regclass::oid")
        original_oid = r.get_connection().execute(identity_sql).scalar_one()
        original_predicate = _reflected_predicate(r)
        r.get_connection().commit()
        r2 = new_test_runner(after, r)
        changes = r2.compute_changes()
        assert len(changes) == 1
        assert [type(op) for op in changes[0].ops] == [alembicops.AlterColumnOp]
        r2.run()

        def assert_state(column_type):
            assert _reflected_predicate(r2) == original_predicate
            assert r2.get_connection().execute(identity_sql).scalar_one() == original_oid
            columns = {column["name"]: column for column in sa.inspect(r2.engine).get_columns("contacts")}
            assert isinstance(columns["score"]["type"], column_type)
            assert r2.get_connection().execute(sa.text(
                'SELECT id, owner_id, status, score, "unrelated score" FROM contacts'
            )).all() == [(1, 10, "active", "score", "score")]
            r2.get_connection().commit()

        assert_state(sa.Text)
        assert r2.compute_changes() == []
        r2.downgrade("-1", delete_files=False)
        assert_state(sa.VARCHAR)
        restored = new_test_runner(before, r2)
        assert restored.compute_changes() == []
        r2 = new_test_runner(after, restored)
        r2.upgrade()
        assert_state(sa.Text)
        assert r2.compute_changes() == []
        _assert_no_predicate_views(r2)

    @pytest.mark.parametrize("shape", ["row", "mixed", "array", "domain"])
    def test_whole_row_type_changes_retain_timestamp_precision(self, new_test_runner, shape):
        row = "contacts = ROW(1, 'active', '2020-01-03 12:00:00')::contacts"
        if shape == "array":
            row = '''contacts = ANY ('{"(1,active,2020-01-03 12:00:00)"}'::contacts[])'''
        elif shape == "domain":
            row = "contacts = '(1,active,2020-01-03 12:00:00)'::contact_row"
        predicate = row if shape == "row" else f"status = 'active' AND {row}"

        def metadata(score_type):
            result = sa.MetaData()
            table = sa.Table(
                "contacts", result,
                sa.Column("id", sa.Integer(), primary_key=True),
                sa.Column("status", sa.Text()),
                sa.Column("score", score_type),
            )
            sa.Index("contacts_active_idx", table.c.id, postgresql_where=sa.text(predicate))
            return result

        before, after = metadata(sa.Date()), metadata(sa.TIMESTAMP())
        r = new_test_runner(before)
        if shape == "domain":
            # This unmanaged domain depends on the table's composite type.
            r.get_connection().execute(sa.schema.CreateTable(before.tables["contacts"]))
            r.get_connection().exec_driver_sql("CREATE DOMAIN contact_row AS contacts")
            r.get_connection().commit()
        r.run()
        original_predicate = _reflected_predicate(r)
        assert "12:00:00" not in original_predicate
        r.get_connection().execute(sa.text(
            "INSERT INTO contacts (id, status, score) VALUES (1, 'active', DATE '2020-01-03')"
        ))
        r.get_connection().commit()
        r2 = new_test_runner(after, r)
        r2.run()
        updated_predicate = _reflected_predicate(r2)
        assert "12:00:00" in updated_predicate
        assert r2.get_connection().execute(sa.text("SELECT score::text FROM contacts")).scalar_one() == "2020-01-03 00:00:00"
        assert r2.get_connection().execute(sa.text(
            f"SELECT count(*) FROM contacts WHERE {updated_predicate}"
        )).scalar_one() == 0
        r2.get_connection().commit()
        assert r2.compute_changes() == []
        r2.downgrade("-1", delete_files=False)
        assert _reflected_predicate(r2) == original_predicate
        restored = new_test_runner(before, r2)
        assert restored.compute_changes() == []
        r2 = new_test_runner(after, restored)
        r2.upgrade()
        assert _reflected_predicate(r2) == updated_predicate
        assert r2.compute_changes() == []
        _assert_no_predicate_views(r2)
