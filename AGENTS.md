# Internal agent guidance

This file documents behavior expectations for dev branch schema support.
It is intended for contributors and automation working on this repo.

## Dev schema isolation (Postgres only)

Default contract:
- `include_public = false` by default (strict isolation).
- `search_path` is set to the dev schema only (public is opt-in).
- Alembic reflection/compare is limited to the dev schema when enabled.
- `alembic_version` is created in the dev schema.
- Registry writes are best-effort; failures should not block schema setup.
- Empty-DB compare flows (e.g. `all_sql`, `squash all`) must skip registry writes
  and must reflect only the dev schema to avoid false "non-empty" errors.

Opt-in public fallback:
- If `include_public = true`, `search_path` becomes `<dev_schema>, public`.
- Even with public in search_path, reflection/compare must still be limited
  to `<dev_schema>` to avoid autogen skipping dev-schema tables.

Schema filtering:
- When dev schema is active, exclude objects whose schema is not the dev schema.
- If schema is `None`, treat it as `public` and exclude it to prevent leakage.

Environment hints used by registry metadata:
- `ENT_DEV_SCHEMA_BRANCH`, `ENT_DEV_BRANCH`, `GIT_BRANCH`, `BRANCH_NAME`.

Enablement & naming:
- `NODE_ENV=production` disables dev schemas everywhere.
- `ENT_DEV_SCHEMA_ENABLED` overrides config/state (force on/off).
- If config is provided, `devSchema.enabled` is authoritative; `schemaName` alone does not enable.
- If no config is provided, the presence of the state file enables dev schema.
- `ignoreBranches` disables dev schemas on listed branches unless force-enabled via `ENT_DEV_SCHEMA_ENABLED=true`.
- Explicit `schemaName` is sanitized (lowercase, non-alnum -> `_`, trimmed, max 63 chars).
- If a sanitized name starts with a digit, prefix with `schema_`.
- Branch-derived names use `ent_dev_<branchSlug>_<hash>` (short SHA1).

Cross-layer flow (Go -> TS):
- Go codegen reads `ent.yml` and writes `src/schema/.ent/dev_schema.json`.
- TS runtime does not read `ent.yml`; it reads the state file only when no runtime config is provided.
- Runtime config passed to TS (`devSchema` in `setConfig`) overrides the state file.
- Go auto_schema invokes Python auto_schema with `--db_schema` and `--db_schema_include_public`.

Branch mismatch:
- Branch mismatch checks apply only when using the state file (not with explicit `schemaName` in runtime config).
