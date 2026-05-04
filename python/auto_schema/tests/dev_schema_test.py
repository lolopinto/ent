import uuid
import pytest
import sqlalchemy as sa

from auto_schema import schema_item


class TestPostgresDevSchema(object):
    @pytest.mark.parametrize("include_public", ["false", "true"])
    @pytest.mark.usefixtures("metadata_with_table")
    def test_compute_changes_empty_after_dev_schema_upgrade(
        self, new_test_runner, metadata_with_table, empty_metadata, include_public
    ):
        prev_runner = None
        if include_public == "true":
            prev_runner = new_test_runner(empty_metadata)
            prev_runner.get_connection().execute(
                sa.text("CREATE TABLE public.accounts (id INTEGER PRIMARY KEY)")
            )
            prev_runner.get_connection().commit()

        schema = f"ent_dev_test_{uuid.uuid4().hex[:8]}"
        r = new_test_runner(
            metadata_with_table,
            prev_runner=prev_runner,
            args_override={
                "db_schema": schema,
                "db_schema_include_public": include_public,
            },
        )

        r.run()
        r.get_connection().commit()

        assert r.compute_changes() == []

    def test_compute_changes_empty_after_dev_schema_upgrade_with_extension_type(
        self, new_test_runner
    ):
        metadata = sa.MetaData()
        metadata.info["db_extensions"] = {
            "public": [
                {
                    "name": "hstore",
                    "provisioned_by": "ent",
                    "version": None,
                    "install_schema": None,
                    "runtime_schemas": ["public"],
                    "drop_cascade": False,
                }
            ]
        }
        sa.Table(
            "preferences",
            metadata,
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column(
                "attrs",
                schema_item.CustomSQLAlchemyType("hstore"),
                nullable=True,
            ),
            sa.PrimaryKeyConstraint("id", name="preferences_id_pkey"),
        )

        schema = f"ent_dev_test_{uuid.uuid4().hex[:8]}"
        r = new_test_runner(
            metadata,
            args_override={
                "db_schema": schema,
                "db_schema_include_public": "false",
            },
        )

        r.run()
        r.get_connection().commit()

        assert r.compute_changes() == []

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

    @pytest.mark.usefixtures("empty_metadata")
    def test_dev_schema_includes_extension_runtime_schema_in_search_path(
        self, new_test_runner, empty_metadata
    ):
        empty_metadata.info["db_extensions"] = {
            "public": [
                {
                    "name": "vector",
                    "provisioned_by": "ent",
                    "version": None,
                    "install_schema": "public",
                    "runtime_schemas": ["public"],
                    "drop_cascade": False,
                }
            ]
        }
        schema = f"ent_dev_test_{uuid.uuid4().hex[:8]}"
        r = new_test_runner(
            empty_metadata,
            args_override={
                "db_schema": schema,
                "db_schema_include_public": "false",
            },
        )

        row = r.get_connection().execute(sa.text("SHOW search_path")).first()
        assert row is not None
        assert row._asdict()["search_path"] == f"{schema}, public"

    @pytest.mark.usefixtures("empty_metadata")
    def test_migrations_against_empty_ignores_extension_tables(
        self, new_test_runner, empty_metadata
    ):
        setup_runner = new_test_runner(empty_metadata)
        setup_runner.get_connection().execute(
            sa.text("CREATE TABLE public.geometry_columns (id INTEGER PRIMARY KEY)")
        )
        setup_runner.get_connection().commit()

        r = new_test_runner(empty_metadata, prev_runner=setup_runner)
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
