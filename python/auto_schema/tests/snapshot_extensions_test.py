import io
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import Mock

from alembic.migration import MigrationContext
from alembic.operations import Operations
import pytest
import sqlalchemy as sa

from auto_schema import compare


@pytest.fixture
def extension_runner(new_test_runner):
    r = new_test_runner(sa.MetaData())
    packages = set(r.connection.execute(sa.text(
        "SELECT name FROM pg_available_extensions"
    )).scalars())
    required = {"ent_snapshot_path", "ent_snapshot_dependent", "Ent_Snapshot_Identity", "ent_snapshot_identity"}
    if not required <= packages:
        message = "Install tests/fixtures extension packages as described in README.MD"
        if os.getenv("AUTO_SCHEMA_EXTENSION_FIXTURES") == "1":
            pytest.fail(message)
        pytest.skip(message)
    return r


class TestPostgresSnapshotExtensions:
    def test_snapshot_uses_validated_default_on_another_server(self, extension_runner):
        r = extension_runner
        # Model a comparison server with default 2 while this replay server has
        # default 1. Only comparison metadata is mocked; render and replay are real.
        comparison = Mock()
        comparison.execute.side_effect = [[("ent_snapshot_identity", "2", "2", None)], []]
        planned = compare._plan_snapshot_extension_ops(comparison, [
            compare._normalize_db_extension({"name": "ent_snapshot_identity"}),
        ], {})
        output = io.StringIO()
        operations = Operations(MigrationContext.configure(connection=r.connection, opts={
            "as_sql": True, "ent_schema_sql": True, "output_buffer": output,
        }))
        for op in planned:
            operations.invoke(op)
        sql = output.getvalue()
        assert r.connection.exec_driver_sql("""
            SELECT default_version FROM pg_available_extensions WHERE name = 'ent_snapshot_identity'
        """).scalar_one() == "1"
        r.connection.exec_driver_sql(sql)
        assert r.connection.exec_driver_sql("""
            SELECT extversion FROM pg_extension WHERE extname = 'ent_snapshot_identity'
        """).scalar_one() == "2"

    @pytest.mark.parametrize("external", [False, True])
    def test_rejects_installed_identity_conflicting_with_exact_prerequisite(self, extension_runner, tmp_path, external):
        r = extension_runner
        r.connection.exec_driver_sql('CREATE EXTENSION "Ent_Snapshot_Identity"')
        r.connection.commit()
        r.metadata.info["db_extensions"] = {"public": [
            {"name": "ent_snapshot_dependent"},
            {"name": "ent_snapshot_identity", "provisioned_by": "external" if external else "ent"},
        ]}
        path = tmp_path / "schema.sql"
        path.write_text("previous snapshot\n")
        with pytest.raises(ValueError, match='requires exact db extension "ent_snapshot_identity"'):
            r.all_sql(file=path, database=r.engine.url.database)
        assert path.read_text() == "previous snapshot\n"
        # Once the exact prerequisite is present, the same declarations resolve
        # correctly even while the differently cased installation remains.
        r.connection.exec_driver_sql("CREATE EXTENSION ent_snapshot_identity")
        r.connection.commit()
        r.all_sql(file=path, database=r.engine.url.database)
        r.connection.exec_driver_sql(path.read_text())
        assert r.connection.exec_driver_sql("""
            SELECT count(*) FROM pg_extension WHERE extname = 'ent_snapshot_dependent'
        """).scalar_one() == 1

    @pytest.mark.parametrize("version", [None, "3"])
    def test_rejects_prerequisites_dropped_by_target_version(self, extension_runner, tmp_path, version):
        r = extension_runner
        r.metadata.info["db_extensions"] = {"public": [
            {"name": "ent_snapshot_path", "version": version}, {"name": "cube"},
        ]}
        # The target metadata alone conceals the prerequisite at version 2.
        assert r.connection.execute(sa.text("""
            SELECT requires FROM pg_available_extension_versions
            WHERE name = 'ent_snapshot_path' AND version = '3'
        """)).scalar_one() is None
        with pytest.raises(sa.exc.DBAPIError, match='required extension "cube" is not installed'):
            r.connection.exec_driver_sql("CREATE EXTENSION ent_snapshot_path VERSION '3'")
        r.connection.rollback()
        path = tmp_path / "schema.sql"
        path.write_text("previous snapshot\n")
        with pytest.raises(ValueError, match='cannot verify installation prerequisites.*ent_snapshot_path'):
            r.all_sql(file=path)
        assert path.read_text() == "previous snapshot\n"

    def test_replays_when_target_covers_all_installation_prerequisites(self, extension_runner, tmp_path):
        r = extension_runner
        r.metadata.info["db_extensions"] = {"public": [
            {"name": "ent_snapshot_path", "version": "4"}, {"name": "cube"},
        ]}
        path = tmp_path / "schema.sql"
        r.all_sql(file=path)
        sql = path.read_text()
        assert sql.index('CREATE EXTENSION IF NOT EXISTS "cube"') < sql.index('CREATE EXTENSION IF NOT EXISTS "ent_snapshot_path"')
        assert "hstore" not in sql
        r.connection.exec_driver_sql(sql)
        assert r.connection.execute(sa.text(
            "SELECT extversion FROM pg_extension WHERE extname = 'ent_snapshot_path'"
        )).scalar_one() == "4"
        assert r.compute_changes() == []

    @pytest.mark.parametrize("both_installed", [False, True])
    def test_preserves_installed_exact_identity(self, extension_runner, new_test_runner, tmp_path, both_installed):
        r = extension_runner
        r.connection.exec_driver_sql('CREATE EXTENSION "Ent_Snapshot_Identity"')
        if both_installed:
            r.connection.exec_driver_sql('CREATE EXTENSION "ent_snapshot_identity"')
        r.connection.commit()
        # Exact declarations select an exact installed name; an unambiguous
        # case-insensitive declaration keeps the existing installation's identity.
        declared = "Ent_Snapshot_Identity" if both_installed else "ent_snapshot_identity"
        r.metadata.info["db_extensions"] = {"public": [{"name": declared}]}
        path = tmp_path / "schema.sql"
        r.all_sql(file=path, database=r.engine.url.database)
        sql = path.read_text()
        assert 'CREATE EXTENSION IF NOT EXISTS "Ent_Snapshot_Identity"' in sql
        assert 'CREATE EXTENSION IF NOT EXISTS "ent_snapshot_identity"' not in sql
        target = new_test_runner(sa.MetaData(), new_database=True)
        target.connection.exec_driver_sql(sql)
        assert set(target.connection.execute(sa.text(
            "SELECT extname FROM pg_extension WHERE extname <> 'plpgsql'"
        )).scalars()) == {"Ent_Snapshot_Identity"}

    @pytest.mark.parametrize("mode", ["--all_sql", "--run_and_all_sql"])
    @pytest.mark.parametrize("to_file", [False, True])
    def test_cli_snapshot_failure_and_success(self, extension_runner, new_test_runner, tmp_path, mode, to_file):
        r = extension_runner
        # Normal migration comparison succeeds. Only standalone generation
        # rejects the incomplete prerequisite contract for the requested target.
        r.connection.exec_driver_sql("CREATE EXTENSION cube")
        r.connection.exec_driver_sql("CREATE EXTENSION ent_snapshot_path VERSION '3'")
        r.connection.commit()
        schema = tmp_path / "schema.py"
        schema.write_text('''import sqlalchemy as sa
def get_metadata():
    metadata = sa.MetaData()
    metadata.info["db_extensions"] = {"public": [{"name": "ent_snapshot_path"}, {"name": "cube"}]}
    return metadata
''')
        output = tmp_path / "schema.sql"
        output.write_text("previous snapshot\n")
        command = [sys.executable, "-c", "from auto_schema.cli import main; main()",
                   "-s", str(tmp_path), "-e", r.engine.url.render_as_string(hide_password=False), mode]
        if to_file:
            command.extend(["--file", str(output)])
        result = subprocess.run(command, capture_output=True, text=True, cwd=Path(__file__).parents[1])
        assert result.returncode == 1, result.stderr
        assert "cannot verify installation prerequisites" in result.stderr
        assert "CREATE EXTENSION" not in result.stdout
        assert output.read_text() == "previous snapshot\n"
        schema.write_text(schema.read_text().replace(
            '{"name": "ent_snapshot_path"}', '{"name": "ent_snapshot_path", "version": "4"}',
        ))
        result = subprocess.run(command, capture_output=True, text=True, cwd=Path(__file__).parents[1])
        assert result.returncode == 0, result.stderr
        sql = output.read_text() if to_file else result.stdout
        assert 'CREATE EXTENSION IF NOT EXISTS "ent_snapshot_path" WITH VERSION \'4\'' in sql
        target = new_test_runner(sa.MetaData(), new_database=True)
        # Replay the complete CLI output, including anything emitted by the
        # migration phase, rather than extracting the SQL-looking portion.
        target.connection.exec_driver_sql(sql)
        assert sql.startswith("-- ent schema snapshot format: 1\n")
        assert target.connection.exec_driver_sql(
            "SELECT extversion FROM pg_extension WHERE extname = 'ent_snapshot_path'"
        ).scalar_one() == "4"
