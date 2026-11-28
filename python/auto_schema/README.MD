This takes a [sqlalchemy](https://www.sqlalchemy.org/) schema and applies [alembic](https://alembic.sqlalchemy.org/en/latest/) migrations.

It's used by the ent framework on top of  [alembic autogenerate](https://alembic.sqlalchemy.org/en/latest/autogenerate.html) to ensure that all supported schema types are automatically handled.

Called as follows: `auto_schema -s={pathToSchema} -e={engineURL}`.

Supports PostgreSQL and SQLite. Database extensions are PostgreSQL-only.

## Concurrent indexes

auto_schema renders `CREATE INDEX CONCURRENTLY` when the SQLAlchemy index uses `postgresql_concurrently=True`. This is surfaced in ent via `indices: [{ ..., concurrently: true }]` or field-level `indexConcurrently: true` for `index: true`.

Notes:
- Concurrent index ops are wrapped in `autocommit_block()` in generated Alembic revisions.
- Drops are only concurrent if the generated op explicitly includes `postgresql_concurrently=True` (it cannot be inferred for removed indexes).

Design notes and tradeoffs:
- We do not default to concurrent drops. `DROP INDEX CONCURRENTLY` is Postgres-specific and must run outside a transaction; defaulting it everywhere would be surprising and would break non-Postgres use.
- We cannot infer whether an existing index was created concurrently once it is removed from schema. Postgres does not store that metadata, and Alembic's diff only yields a `DropIndexOp` without the flag.
- Alembic can render `postgresql_concurrently=True`, but it does not automatically wrap it in `autocommit_block()`. To guarantee correctness we use a renderer override; alternatives are custom ops that emit SQL or an autogenerate rewriter.

If we ever want concurrent drops, options include:
- Per-index `dropConcurrently` in schema.
- A global Postgres-only config flag to drop indexes concurrently (with warnings).
- A migration helper users can call explicitly when needed.

## Partial indexes

Partial indexes are supported via `postgresql_where=sa.text(...)` and `sqlite_where=sa.text(...)` in SQLAlchemy. In ent schema, use `indices: [{ ..., where: "place = 1" }]` or `indexWhere: "place = 1"` for `index: true`. The clause is a raw SQL string and should reference DB column names.

## Replaying PostgreSQL extension snapshots

`auto_schema --all_sql` builds a snapshot for a fresh application schema. It includes Ent-managed extensions even when the comparison database already has them, and orders them using PostgreSQL's dependency metadata. Managed extension setup uses the exact resolved package name and version. If no version is declared, the snapshot pins the comparison server's default version that was validated during generation; it does not choose a new default during replay.

PostgreSQL snapshots start with `-- ent schema snapshot format: 1`. When regenerating SQL, updated Ent codegen accepts the transition from an unmarked snapshot without requiring a new migration. Incremental consistency checks still reject later SQL changes without a migration and unexplained changes to `schema.py`. When using an older `tsent` binary with updated `auto_schema`, run `tsent codegen --write-all` once to refresh the snapshot.

Without `--file`, the complete stdout from `--all_sql` or `--run_and_all_sql` is the replayable snapshot. Migration progress from `--run_and_all_sql` goes to stderr in this mode. File output retains the existing progress stream.

The replay target may already contain matching extensions. A different installed version or declared `installSchema` produces a clear replay error. Generated extension setup does not upgrade, downgrade, or relocate installed extensions; apply those changes through normal migrations before replay. Extension checks use PL/pgSQL, so the target needs `plpgsql` and the replay role needs `USAGE` on that language.

The PostgreSQL instance hosting the comparison database must have the package files and dependency metadata for each Ent-managed extension's requested version, or its default version when none is specified. The extensions do not need to be enabled with `CREATE EXTENSION` in the comparison database. Generation fails if a package or version's metadata is unavailable; install the matching extension package on that PostgreSQL instance before generating the snapshot. An empty comparison database on the same instance shares its available extension packages.

PostgreSQL can install a target version by installing an earlier version and running update scripts. Snapshot generation verifies that the target's prerequisites cover those of every installable version with an update path to the target. Versions with no path to the target do not affect ordering. PostgreSQL's public catalogs do not identify the starting install script, so this conservative check can reject a package even when the target has a direct install script. If the check fails, use `--progressive_sql` with a verified migration installation order, or a package/version whose target prerequisites cover its installation paths. Generation does not guess the path or add dependencies from unrelated versions.

An extension installed in the comparison database retains its exact catalog identity. A differently cased package cannot substitute for it; missing metadata for that exact package still fails generation. Ambiguous case-insensitive names require an exact declaration. If a declaration resolves to a different spelling than a prerequisite requires, generation fails; declare the exact prerequisite and provide a matching comparison baseline. Extension identity and prerequisite validation errors leave an existing snapshot file untouched, emit no snapshot SQL, and return a nonzero CLI exit status, including with `--run_and_all_sql`.

Extension-owned tables and existing Ent DDL exclusions such as `spatial_ref_sys` are allowed in the comparison database. An excluded table does not need extension membership to supply a seed comparison baseline. Other application tables still fail the empty-database check. Extension ownership does not predict which objects a fresh installation will create. Validate the generated SQL by replaying it on a disposable target with the required external prerequisites; object-name conflicts are reported during replay.

Application tables created by the snapshot start with their declared seed rows. Explicit seeds for physical tables provisioned outside the snapshot retain the existing comparison-based insert, update, and delete behavior; the comparison database must represent those tables and their initial data. Writable views retain insert-only seeding, preserving existing rows.

Seed statements use unqualified table names. Generate and replay with the same `search_path` and required schemas already present. When table names repeat across schemas, seeds follow the first matching relation on that path, including tables created by the snapshot.

This baseline requirement also applies to tables supplied by Ent-managed extensions. To override extension-supplied rows, use `--empty_database` to select a comparison database with the matching extension version and install schema already provisioned, including representative initial data. A fully empty comparison database cannot derive updates or deletions to those rows.

Declare any required `version` or `installSchema` in `dbExtensions`. Generated extension statements run before retained custom SQL, so a later `CREATE EXTENSION IF NOT EXISTS` skips its install options. Create any custom install schema before replay. If retained revisions also create the schema or extension, use `CREATE SCHEMA IF NOT EXISTS` and `CREATE EXTENSION IF NOT EXISTS` in those revisions. Use `auto_schema --progressive_sql` when installation depends on the original migration order.

### Scope and exclusions

| Outside the snapshot contract | Required handling |
| --- | --- |
| Automatically upgrading, downgrading, or relocating preinstalled extensions, including their historical update paths | Use normal migrations. Generated extension setup rejects a version or declared-schema mismatch. |
| Installing server packages or automatically provisioning undeclared/external prerequisites | Install matching packages and provision external prerequisites on the replay target. Generated extension setup does not use `CREATE EXTENSION ... CASCADE`. |
| Fresh-install paths whose prerequisite coverage cannot be established from public metadata | Generation rejects them conservatively, even if a direct install script might work. Use a compatible package/version or verified progressive migration SQL. |
| Reconstructing historical custom-SQL or backfill ordering | Snapshots append retained custom SQL after generated schema operations. Use `--progressive_sql` when original migration order is required, and test its replay. |
| Creating custom install schemas or translating seed statements between search paths | Precreate schemas and use matching generation/replay search paths. |
| Deriving updates/deletions to extension-supplied seed rows from a fully empty baseline | Provide representative initial data in the comparison database. |
| Predicting arbitrary extension-script object creation, collisions, or changes to package contents under the same version label | Validate replay against the intended packages on a disposable target. Name/version checks do not compare package contents. |

Retained custom SQL runs as written; the generated extension checks do not constrain its effects. `--run_and_all_sql` still performs normal migrations before snapshot generation. If generation then fails, its nonzero status does not roll back those completed migrations. For replay, use a transaction where supported if the entire snapshot must succeed atomically.

## Testing extension installation paths

The owning-package tests include real extension packages with intermediate-version prerequisites and case-distinct names. CI installs these fixtures in each disposable PostgreSQL service before running the normal test suite. To run them locally against a disposable Docker container, from `python/auto_schema`:

```sh
python tests/fixtures/write_extension_packages.py /tmp/auto-schema-extensions.tar
pg_share_dir=$(docker exec "$POSTGRES_CONTAINER" psql -U postgres -Atc "SELECT setting FROM pg_config WHERE name = 'SHAREDIR'")
docker cp - "$POSTGRES_CONTAINER:$pg_share_dir/extension/" < /tmp/auto-schema-extensions.tar
AUTO_SCHEMA_EXTENSION_FIXTURES=1 DB_CONNECTION_STRING=postgresql://postgres:password@localhost:5432 pytest
```

Set `POSTGRES_CONTAINER` to the disposable container's name and use its connection URL. The tar archive preserves both package spellings on case-insensitive host filesystems. Without the packages, their CLI/replay tests skip locally; `AUTO_SCHEMA_EXTENSION_FIXTURES=1` makes missing fixtures fail, as in CI. Catalog-planning unit regressions always run.
