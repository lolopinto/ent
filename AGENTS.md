# Internal agent guidance

This file documents behavior expectations for dev branch schema support.
It is intended for contributors and automation working on this repo.

## Local testing

When changing code in `ts/`, validate in this order:

1. Run targeted package tests in `ts/` first.
2. If the change affects runtime behavior consumed by examples, rebuild `ts/dist`
   via `cd ts && npm run compile`.
3. Run only the relevant example tests while iterating.
4. Before landing broader runtime changes, run the full example matrix below.

Package-level commands:

- `cd ts && npm test -- --runInBand`
- `cd ts && npm test -- src/action/orchestrator.test.ts --runInBand`
- `cd ts && npm test -- src/action/transformed_orchestrator.test.ts --runInBand`
- `cd ts && npm run compile`

Example test matrix:

- `examples/simple`
  `cd examples/simple && POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres npm test -- --runInBand`
- `examples/ent-local-guide`
  `cd examples/ent-local-guide && npm run db:up && POSTGRES_TEST_DB=ent-local-guide POSTGRES_PORT=54329 npm test -- --runInBand`
- `examples/ent-semantic-notes`
  `cd examples/ent-semantic-notes && npm run db:up && POSTGRES_TEST_DB=ent_semantic_notes POSTGRES_PORT=54330 npm test -- --runInBand`
- `examples/todo-sqlite`
  `cd examples/todo-sqlite && npm test -- --runInBand`

How examples pick up local `@snowtop/ent` changes:

- `examples/ent-local-guide` and `examples/ent-semantic-notes` already map
  `@snowtop/ent` to local `../../ts/src` in Jest, so their tests exercise local
  TS changes directly.
- `examples/simple` and `examples/todo-sqlite` still use the installed package
  by default. Their normal `npm test` runs do not prove local `ts/` changes.
- When validating local `ts/` changes against `simple` or `todo-sqlite`, use a
  temporary Jest override (or equivalent local-only config change) that maps:
  - `^@snowtop/ent$` -> `<rootDir>/../../ts/src/index.ts`
  - `^@snowtop/ent/(.*)$` -> `<rootDir>/../../ts/src/$1`
- Do not rely on a published package version for local validation of runtime
  fixes. If a temporary example-only test override is added for local
  verification, revert it before finishing unless updating the example test
  wiring is part of the intended change.

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

Registry metadata:

- `public.ent_dev_schema_registry.branch_name` is best-effort metadata and may be empty; do not rely on it for behavior.
- State-file `branchName` in `src/schema/.ent/dev_schema.json` is different: when present, it is used for stale-branch protection.

Enablement & naming:

- `NODE_ENV=production` disables dev schemas everywhere.
- `ENT_DEV_SCHEMA_ENABLED` overrides config/state (force on/off).
- If config is provided, `devSchema.enabled` is authoritative; `schemaName` alone does not enable.
- If runtime config is provided to TS, it is self-sufficient: explicit `schemaName` wins, otherwise the current git branch is used directly.
- If no runtime config is provided, the generated state file is the fallback source of truth.
- `ignoreBranches` disables dev schemas on listed branches unless force-enabled via `ENT_DEV_SCHEMA_ENABLED=true`.
- Explicit `schemaName` is sanitized (lowercase, non-alnum -> `_`, trimmed, max 63 chars).
- If a sanitized name starts with a digit, prefix with `schema_`.
- Branch-derived names use `ent_dev_<branchSlug>_<hash>` (short SHA1).

Cross-layer flow (Go -> TS):

- Go codegen reads `ent.yml` and writes `src/schema/.ent/dev_schema.json`.
- TS runtime does not read `ent.yml`; it reads the state file only when no runtime config is provided.
- Runtime config passed to TS (`devSchema` in `setConfig`) does not consult the state file.
- Go auto_schema invokes Python auto_schema with `--db_schema` and `--db_schema_include_public`.

Branch mismatch:

- State-file mode fails closed if the current branch is missing or does not match the stored `branchName`.
- Explicit `schemaName` bypasses branch-derived naming and state mismatch checks.

Pruning:

- `devSchema.prune` is a codegen/tooling feature, not a TS runtime feature.
- TS runtime validates/touches schemas but does not prune on connection open.
- `tsent prune_schemas` must connect without runtime dev-schema setup so `--dry-run` remains non-destructive.
