import os
import shutil

import alembic.operations.ops as alembicops
import pytest
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from auto_schema import ops
from .runner_test import _assert_no_predicate_views, _partial_index_metadata, _reflected_predicate


class TestPostgresPredicateDependencies:
    @pytest.mark.parametrize("full_text", [False, True])
    @pytest.mark.parametrize("declaration", ["new_label", "new_table", "new_column"])
    @pytest.mark.parametrize("enum_name,enum_schema,sql_type", [
        ("other_status", None, "other_status"),
        ("other_status", "public", "public.other_status"),
    ])
    def test_pending_enum_from_other_table(
        self, new_test_runner, full_text, declaration, enum_name, enum_schema, sql_type,
    ):
        def metadata(after):
            predicate = (
                f"score > CASE WHEN 'archived'::{sql_type} = 'active'::{sql_type} THEN 2 ELSE 1 END"
                if after else "score > 0"
            )
            result = _partial_index_metadata(predicate, full_text=full_text)
            if after or declaration != "new_table":
                other = sa.Table("other", result, sa.Column("id", sa.Integer(), primary_key=True))
                if after or declaration == "new_label":
                    other.append_column(sa.Column("status", postgresql.ENUM(
                        *(["active", "archived"] if after else ["active"]),
                        name=enum_name, schema=enum_schema, create_type=False,
                    )))
            return result

        before, after = metadata(False), metadata(True)
        r = new_test_runner(before)
        r.run()
        r.get_connection().execute(before.tables["contacts"].insert(), [
            {"id": i, "owner_id": i, "score": i, "status": "active"} for i in (1, 2, 3)
        ])
        r.get_connection().commit()
        original_predicate = _reflected_predicate(r)
        r2 = new_test_runner(after, r)
        changes = r2.compute_changes()
        assert isinstance(changes[0], ops.AlterEnumOp if declaration == "new_label" else ops.AddEnumOp)
        indexes = next(op for op in changes if isinstance(op, alembicops.ModifyTableOps) and op.table_name == "contacts")
        assert [type(op) for op in indexes.ops] == (
            [ops.DropFullTextIndexOp, ops.CreateFullTextIndexOp] if full_text else
            [alembicops.DropIndexOp, alembicops.CreateIndexOp]
        )
        r2.revision()
        # Generation must leave both the enum catalog and the old index intact.
        assert _reflected_predicate(r2) == original_predicate
        enums = sa.inspect(r2.engine).get_enums(schema="*")
        assert [enum["labels"] for enum in enums if enum["name"] == enum_name] == (
            [["active"]] if declaration == "new_label" else []
        )
        _assert_no_predicate_views(r2)
        r2.upgrade()
        updated_predicate = _reflected_predicate(r2)
        assert updated_predicate != original_predicate
        assert r2.get_connection().exec_driver_sql(
            f"SELECT id FROM contacts WHERE {updated_predicate} ORDER BY id"
        ).scalars().all() == [2, 3]
        assert r2.get_connection().execute(sa.text("SELECT id, score FROM contacts ORDER BY id")).all() == [(1, 1), (2, 2), (3, 3)]
        r2.get_connection().commit()
        for _ in range(2):
            assert r2.compute_changes() == []
        if declaration == "new_label":
            # Enum additions are irreversible; replay generated revisions instead.
            replay = new_test_runner(after, new_database=True)
            shutil.copytree(
                os.path.join(r2.get_schema_path(), "versions"),
                os.path.join(replay.get_schema_path(), "versions"), dirs_exist_ok=True,
            )
            replay.upgrade()
            assert replay.compute_changes() == []
        else:
            r2.downgrade("-1", delete_files=False)
            assert _reflected_predicate(r2) == original_predicate
            assert sa.inspect(r2.engine).get_enums(schema="*") == []
            restored = new_test_runner(before, r2)
            assert restored.compute_changes() == []
            r2 = new_test_runner(after, restored)
            r2.upgrade()
            assert _reflected_predicate(r2) == updated_predicate
            assert r2.compute_changes() == []
        _assert_no_predicate_views(r2)

    @pytest.mark.parametrize("full_text", [False, True])
    @pytest.mark.parametrize("missing_type", [False, True])
    def test_invalid_enum_cast_without_pending_change_fails(self, new_test_runner, full_text, missing_type):
        def metadata(after):
            result = _partial_index_metadata(
                "score > CASE WHEN 'typo'::other_status = 'active'::other_status THEN 2 ELSE 1 END"
                if after else "score > 0", full_text=full_text,
            )
            if not missing_type:
                sa.Table("other", result, sa.Column("id", sa.Integer(), primary_key=True),
                         sa.Column("status", postgresql.ENUM("active", name="other_status", create_type=False)))
            return result

        r = new_test_runner(metadata(False))
        r.run()
        original_predicate = _reflected_predicate(r)
        r2 = new_test_runner(metadata(True), r)
        with pytest.raises(sa.exc.ProgrammingError if missing_type else sa.exc.DataError):
            r2.compute_changes()
        _assert_no_predicate_views(r2)
        assert _reflected_predicate(r2) == original_predicate

    def test_first_label_for_existing_enum(self, new_test_runner):
        def metadata(after):
            result = _partial_index_metadata(
                "score > CASE WHEN 'active'::other_status = 'active'::other_status THEN 2 ELSE 1 END"
                if after else "score > 0",
            )
            sa.Table("other", result, sa.Column("id", sa.Integer(), primary_key=True),
                     sa.Column("status", postgresql.ENUM(
                         *(["active"] if after else []), name="other_status", create_type=False,
                     )))
            return result

        before = metadata(False)
        r = new_test_runner(before)
        # Existing empty enums are valid PostgreSQL; the custom initial enum
        # renderer does not support an empty value list, so seed via native DDL.
        before.tables["other"].c.status.type.create(r.get_connection())
        before.create_all(r.get_connection())
        r.get_connection().commit()
        r.run()
        r2 = new_test_runner(metadata(True), r)
        assert isinstance(r2.compute_changes()[0], ops.AlterEnumOp)
        r2.run()
        assert r2.compute_changes() == []

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
