import alembic.operations.ops as alembicops
import pytest
import sqlalchemy as sa

from auto_schema import ops
from auto_schema import runner
from auto_schema.change_type import ChangeType
from auto_schema.compare import _get_extension_ops
from auto_schema.diff import Diff


def _metadata_with_extensions(*extensions: dict) -> sa.MetaData:
    metadata = sa.MetaData()
    metadata.info["db_extensions"] = {
        "public": list(extensions),
    }
    return metadata


def _get_installed_extensions(r: runner.Runner) -> dict[str, str]:
    rows = r.get_connection().execute(
        sa.text("select extname, extversion from pg_catalog.pg_extension")
    )
    return {row._asdict()["extname"]: row._asdict()["extversion"] for row in rows}


def test_extension_ops_create_update_and_managed_false():
    extension_ops = _get_extension_ops(
        [
            {
                "name": "pgcrypto",
                "managed": True,
                "version": None,
                "install_schema": "public",
                "drop_cascade": False,
            },
            {
                "name": "vector",
                "managed": True,
                "version": "0.5.0",
                "install_schema": "public",
                "drop_cascade": False,
            },
            {
                "name": "uuid-ossp",
                "managed": False,
                "version": None,
                "install_schema": None,
                "drop_cascade": False,
            },
        ],
        {
            "vector": {
                "name": "vector",
                "version": "0.4.1",
                "install_schema": "public",
            },
            "plpgsql": {
                "name": "plpgsql",
                "version": "1.0",
                "install_schema": "pg_catalog",
            },
        },
    )

    assert len(extension_ops) == 2
    assert isinstance(extension_ops[0], ops.CreateExtensionOp)
    assert extension_ops[0].extension_name == "pgcrypto"
    assert isinstance(extension_ops[1], ops.UpdateExtensionOp)
    assert extension_ops[1].extension_name == "vector"
    assert extension_ops[1].from_version == "0.4.1"
    assert extension_ops[1].to_version == "0.5.0"


class PostgresExtensionRunnerTest:
    def test_create_extension_noop_and_downgrade(self, new_test_runner):
        metadata = _metadata_with_extensions(
            {
                "name": "pgcrypto",
                "managed": True,
                "version": None,
                "install_schema": "public",
                "runtime_schemas": ["public"],
                "drop_cascade": False,
            }
        )

        r = new_test_runner(sa.MetaData())
        assert "pgcrypto" not in _get_installed_extensions(r)

        r2 = new_test_runner(metadata, r)
        diff = r2.compute_changes()
        assert len(diff) == 1
        assert isinstance(diff[0], ops.CreateExtensionOp)
        assert r2.revision_message() == "create extension pgcrypto"

        changes = Diff(diff).changes()
        ext_changes = changes.get("db_extensions")
        assert ext_changes == [
            {
                "change": ChangeType.CREATE_EXTENSION,
                "desc": "create extension pgcrypto",
                "extension": "pgcrypto",
            }
        ]

        r2.run()
        assert "pgcrypto" in _get_installed_extensions(r2)

        r3 = new_test_runner(metadata, r2)
        assert r3.compute_changes() == []

        r3.downgrade("-1", delete_files=False)
        assert "pgcrypto" not in _get_installed_extensions(r3)

    def test_managed_false_is_noop(self, new_test_runner):
        metadata = _metadata_with_extensions(
            {
                "name": "pgcrypto",
                "managed": False,
                "version": None,
                "install_schema": "public",
                "runtime_schemas": ["public"],
                "drop_cascade": False,
            }
        )
        r = new_test_runner(metadata)
        assert r.compute_changes() == []

    def test_extensions_require_postgres(self, new_test_runner):
        metadata = _metadata_with_extensions(
            {
                "name": "pgcrypto",
                "managed": True,
                "version": None,
                "install_schema": "public",
                "runtime_schemas": ["public"],
                "drop_cascade": False,
            }
        )
        r = new_test_runner(metadata)
        with pytest.raises(ValueError, match="db extensions are only supported for postgres"):
            r.compute_changes()
