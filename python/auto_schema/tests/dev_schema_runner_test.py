import uuid

import pytest
import sqlalchemy as sa


@pytest.mark.parametrize("schema_idx", [0, 1])
class TestPostgresDevSchemaRunner:
    @pytest.mark.usefixtures("metadata_with_table")
    def test_run_creates_tables_in_schema(
        self, new_test_runner, metadata_with_table, schema_idx
    ):
        schema = f"ent_dev_test_{uuid.uuid4().hex[:8]}_{schema_idx}"
        r = new_test_runner(
            metadata_with_table,
            args_override={
                "db_schema": schema,
                "db_schema_include_public": "false",
            },
        )

        row = r.get_connection().execute(
            sa.text("SELECT current_schema() AS schema_name")
        ).first()
        assert row._asdict()["schema_name"] == schema
        # end the transaction started by the SELECT so we see tables created
        # by alembic on a different connection.
        r.get_connection().commit()

        r.run()
        # r.run() uses the runner connection for autogenerate which starts a
        # transaction; end it so we can see tables created by alembic.
        r.get_connection().commit()

        reflected = sa.MetaData()
        reflected.reflect(bind=r.get_connection())
        assert "accounts" in reflected.tables
        assert "alembic_version" in reflected.tables

    @pytest.mark.usefixtures("metadata_with_two_tables")
    def test_run_creates_multiple_tables_in_schema(
        self, new_test_runner, metadata_with_two_tables, schema_idx
    ):
        schema = f"ent_dev_test_{uuid.uuid4().hex[:8]}_{schema_idx}"
        r = new_test_runner(
            metadata_with_two_tables,
            args_override={
                "db_schema": schema,
                "db_schema_include_public": "false",
            },
        )

        row = r.get_connection().execute(
            sa.text("SELECT current_schema() AS schema_name")
        ).first()
        assert row._asdict()["schema_name"] == schema
        r.get_connection().commit()

        r.run()
        r.get_connection().commit()

        reflected = sa.MetaData()
        reflected.reflect(bind=r.get_connection())
        assert "accounts" in reflected.tables
        assert "messages" in reflected.tables
        assert "alembic_version" in reflected.tables
