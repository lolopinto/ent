import uuid
import pytest
import sqlalchemy as sa


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

        # search_path should start with the dev schema
        row = r.get_connection().execute(
            sa.text("SELECT current_schema() AS schema_name")
        ).first()
        assert row._asdict()["schema_name"] == schema
        # end the transaction started by the SELECT so we see tables created
        # by alembic on a different connection.
        r.get_connection().commit()

        # run migrations and ensure tables land in the dev schema
        r.run()
        # r.run() uses the runner connection for autogenerate which starts a
        # transaction; end it so we can see tables created by alembic.
        r.get_connection().commit()
        # validate via reflection using the runner connection (search_path is set)
        reflected = sa.MetaData()
        reflected.reflect(bind=r.get_connection())
        assert "accounts" in reflected.tables
        assert "alembic_version" in reflected.tables

    @pytest.mark.usefixtures("metadata_with_table")
    def test_include_public_true_does_not_skip_public_tables(
        self, new_test_runner, metadata_with_table, empty_metadata
    ):
        r_public = new_test_runner(empty_metadata)
        r_public.get_connection().execute(
            sa.text("CREATE TABLE public.accounts (id INTEGER PRIMARY KEY)")
        )
        r_public.get_connection().commit()

        schema = f"ent_dev_test_{uuid.uuid4().hex[:8]}"
        r = new_test_runner(
            metadata_with_table,
            prev_runner=r_public,
            args_override={
                "db_schema": schema,
                "db_schema_include_public": "true",
            },
        )

        row = r.get_connection().execute(
            sa.text("SELECT current_schema() AS schema_name")
        ).first()
        assert row._asdict()["schema_name"] == schema
        r.get_connection().commit()

        r.run()
        r.get_connection().commit()

        res = r.get_connection().execute(
            sa.text("SELECT to_regclass(:tbl) AS name"),
            {"tbl": f"{schema}.accounts"},
        ).first()
        assert res._asdict()["name"] is not None

    @pytest.mark.usefixtures("empty_metadata")
    def test_migrations_against_empty_skips_registry(self, new_test_runner, empty_metadata):
        schema = f"ent_dev_test_{uuid.uuid4().hex[:8]}"
        r = new_test_runner(
            empty_metadata,
            args_override={
                "db_schema": schema,
                "db_schema_include_public": "true",
            },
        )

        migrations, connection, _, _ = r.migrations_against_empty()
        assert migrations is not None
        connection.close()


class TestDevSchemaSQLite(object):
    def test_dev_schema_errors_on_sqlite(self, new_test_runner, empty_metadata):
        with pytest.raises(Exception, match="only supported for postgres"):
            new_test_runner(
                empty_metadata,
                args_override={"db_schema": "ent_dev_test_sqlite"},
            )
