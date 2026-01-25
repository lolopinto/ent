import uuid
import pytest
import sqlalchemy as sa
import os


class TestPostgresDevSchema(object):
    @pytest.mark.usefixtures("metadata_with_table")
    def test_dev_schema_sets_search_path_and_creates_tables(
        self, new_test_runner, metadata_with_table
    ):
        schema = f"ent_dev_test_{uuid.uuid4().hex[:8]}"
        r = new_test_runner(
            metadata_with_table,
            args_override={
                "db_schema": schema,
                "db_schema_include_public": "false",
            },
        )

        if os.getenv("AUTO_SCHEMA_DEBUG_DB") == "1":
            print("[auto_schema] dev_schema_test connected")

        # search_path should start with the dev schema
        row = r.get_connection().execute(
            sa.text("SELECT current_schema() AS schema_name")
        ).first()
        assert row._asdict()["schema_name"] == schema
        # end the transaction started by the SELECT so we see tables created
        # by alembic on a different connection.
        r.get_connection().commit()

        # run migrations and ensure tables land in the dev schema
        if os.getenv("AUTO_SCHEMA_DEBUG_DB") == "1":
            print("[auto_schema] dev_schema_test starting run")
        r.run()
        if os.getenv("AUTO_SCHEMA_DEBUG_DB") == "1":
            print("[auto_schema] dev_schema_test run complete")
            rows = r.get_connection().execute(
                sa.text(
                    "SELECT table_schema FROM information_schema.tables WHERE table_name = 'accounts' ORDER BY table_schema"
                )
            ).fetchall()
            print(f"[auto_schema] dev_schema_test accounts schemas={rows}")
            all_tables = r.get_connection().execute(
                sa.text(
                    "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name"
                )
            ).fetchall()
            print(f"[auto_schema] dev_schema_test tables={all_tables}")
        # validate via reflection using the runner connection (search_path is set)
        reflected = sa.MetaData()
        reflected.reflect(bind=r.get_connection())
        assert "accounts" in reflected.tables
        assert "alembic_version" in reflected.tables


class TestDevSchemaSQLite(object):
    def test_dev_schema_errors_on_sqlite(self, new_test_runner, empty_metadata):
        with pytest.raises(Exception, match="only supported for postgres"):
            new_test_runner(
                empty_metadata,
                args_override={"db_schema": "ent_dev_test_sqlite"},
            )
