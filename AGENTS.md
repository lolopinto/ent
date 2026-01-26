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
