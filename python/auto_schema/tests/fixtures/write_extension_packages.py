"""Write a tar archive of test-only PostgreSQL extension packages."""
import io
import sys
import tarfile


def write_packages(archive):
    files = {
        # Only version 1 has an install script for the 1 -> 2 -> 3 -> 4 chain.
        # Version 2 needs cube, 3 drops it, and 4 requires it again.
        "ent_snapshot_path.control": "default_version = '3'\nrelocatable = true\n",
        "ent_snapshot_path--1.sql": "SELECT 1;\n",
        "ent_snapshot_path--1--2.sql": "SELECT cube(1);\n",
        "ent_snapshot_path--2.control": "requires = 'cube'\n",
        "ent_snapshot_path--2--3.sql": "SELECT 1;\n",
        "ent_snapshot_path--3--4.sql": "SELECT cube(1);\n",
        "ent_snapshot_path--4.control": "requires = 'cube'\n",
        # An unrelated installable version must not add dependencies to 3 or 4.
        "ent_snapshot_path--9.sql": "SELECT hstore('key', 'value');\n",
        "ent_snapshot_path--9.control": "requires = 'hstore'\n",
        "ent_snapshot_dependent.control": "default_version = '1'\nrequires = 'ent_snapshot_identity'\nrelocatable = true\n",
        "ent_snapshot_dependent--1.sql": "SELECT 1;\n",
    }
    for name in ("Ent_Snapshot_Identity", "ent_snapshot_identity"):
        files[f"{name}.control"] = "default_version = '1'\nrelocatable = true\n"
        files[f"{name}--1.sql"] = "SELECT 1;\n"
        files[f"{name}--2.sql"] = "SELECT 1;\n"
    # A tar archive preserves both case variants even on a case-insensitive host.
    with tarfile.open(archive, "w") as output:
        for name, contents in files.items():
            data = contents.encode()
            entry = tarfile.TarInfo(name)
            entry.size = len(data)
            entry.mode = 0o644
            output.addfile(entry, io.BytesIO(data))


if __name__ == "__main__":
    write_packages(sys.argv[1])
