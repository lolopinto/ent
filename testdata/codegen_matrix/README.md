# Ent Codegen Feature Matrix

The codegen matrix is the broad smoke suite for Ent schema features. It exists
to catch generated TypeScript, GraphQL, import-order, DB schema, and
idempotence regressions before they reach downstream apps.

Run it with:

```sh
go test ./internal/codegenmatrix -count=1
```

Run one fixture while iterating with:

```sh
ENT_CODEGEN_MATRIX_FIXTURE=feature_stress go test ./internal/codegenmatrix -run TestCodegenMatrixFixtures -count=1 -v
ENT_CODEGEN_MATRIX_FIXTURE=feature_stress ENT_CODEGEN_MATRIX_RUNTIME=bun go test ./internal/codegenmatrix -run TestCodegenMatrixFixtures -count=1 -v
ENT_CODEGEN_MATRIX_FIXTURE=db_schema_smoke go test ./internal/codegenmatrix -run TestCodegenMatrixFixtures -count=1 -v
ENT_CODEGEN_MATRIX_POSTGRES_URL=postgres://postgres:postgres@localhost:5432/postgres ENT_CODEGEN_MATRIX_FIXTURE=postgres_schema_smoke go test ./internal/codegenmatrix -run TestCodegenMatrixFixtures -count=1 -v
ENT_CODEGEN_MATRIX_POSTGRES_URL=postgres://postgres:postgres@localhost:5432/postgres ENT_CODEGEN_MATRIX_FIXTURE=postgres_schema_smoke ENT_CODEGEN_MATRIX_RUNTIME=bun go test ./internal/codegenmatrix -run TestCodegenMatrixFixtures -count=1 -v
```

## What It Tests

The matrix catalog lives in `features.yml`.

- `feature_stress` runs TS schema parsing, `tsent codegen --step codegen`,
  `tsent codegen --step graphql`, generated TypeScript typechecking, and
  idempotence checks over a broad schema surface.
  It runs once with the default Node/pg launcher settings and once with
  Bun/Bun SQL settings, so generated Bun-specific resolver exports and
  Postgres value conversion helpers stay covered by the same broad fixture.
- `db_schema_smoke` runs the same checks and also includes
  `tsent codegen --step db` against SQLite-compatible schema features. Its
  idempotence snapshot includes DB-generated schema and migration files. It
  includes the shared core DB schema fixture.
- `postgres_schema_smoke` runs the same full flow against core DB schema
  rendering plus Postgres-only paths such as operator classes and index
  parameters. It creates a generated temporary database for isolation and runs when
  `ENT_CODEGEN_MATRIX_POSTGRES_URL` or a Postgres `DB_CONNECTION_STRING` is
  present; otherwise it skips locally. Go CI already provides Postgres. It runs
  both the default Node/pg path and the Bun/Bun SQL path, and includes the same
  shared core DB schema fixture as `db_schema_smoke`.
- `TestFeatureCatalogClassifiesCodegenInputs` reflects exported fields,
  selected enum constants from `internal/schema/input/input.go`, and action
  operation mappings from `getTSStringOperation`; it verifies every active
  feature in the catalog is either covered by a fixture, delegated to an
  existing test, or skipped with an explicit reason.
- `TestSyntheticOwnersDoNotDuplicateDerivedInputs` keeps the manual
  supplemental owner list limited to non-reflectable inputs.

The harness builds the current checked-out `tsent` and package-shaped
`@snowtop/ent` `ts/dist`, copies fixtures to a temp app, links local
`ts/node_modules` entries plus the freshly built `@snowtop/ent` package, runs
real codegen steps, checks the generated tree is stable across repeated runs,
and then runs `tsc --noEmit` against the generated app.
It locates the repository from the Go test source path, so it does not require
`git rev-parse` at runtime.

## Bar For Adding Coverage

Add matrix coverage when a change affects generated files, schema parsing,
GraphQL generation, DB schema rendering, generated imports, action/builder
types, field-edge/query generation, or a customer-reported generated-code
failure.

The bar is:

- Prefer one representative fixture interaction over a cartesian-product grid.
  A nullable boolean is usually not interesting; an id field with a foreign key,
  field edge, custom name, transform, or privacy policy often is.
- Cover interactions that cross codegen boundaries: field type plus action,
  pattern plus privacy, transform plus generated import, field edge plus indexed
  query, custom GraphQL plus generated object, DB index plus schema output.
- For customer-reported failures, add or extend a behavior-named feature and
  make the fixture fail on the generated compile/idempotence path that would
  have caught it. Keep issue or PR numbers in rationale only when they add
  useful traceability.
- If a feature is supported but cannot yet run in this matrix, mark it
  `mode: skipped` with a focused reason. Do not leave it unclassified.
- If a feature is already covered by a narrower unit/runtime/example test, use
  `mode: existing_test` and list the test refs.
- If a field in `internal/schema/input/input.go` is metadata rather than a
  codegen selector, classify it as `mode: non_codegen` with a rationale.
- Track known matrix gaps as behavior-named skipped features, even when they are
  not tied to a reflected input owner.
- For DB-rendered behavior, set `dialect_coverage` on the feature. Core DB
  behavior should usually declare `dialect_coverage: [sqlite, postgres]`;
  dialect-specific behavior should declare only the dialect it needs. The
  catalog test fails when a declared dialect is not covered by a matching
  fixture, or when a dialect fixture covers a feature that does not declare that
  dialect.

## Adding A Fixture

1. Add files under `testdata/codegen_matrix/fixtures/<fixture_id>`.
2. Add the fixture to `features.yml` with its `surfaces`, `covers`, and optional
   `includes`. DB fixtures must also declare `dialect: sqlite` or
   `dialect: postgres`.
3. Add `runtime_variants` only when the fixture should exercise non-default
   runtime behavior. Omitted variants mean one Node/pg run; Bun SQL variants
   should use `runtime: bun` with `postgresDriver: bun`.
4. Add or update feature entries so every active feature is covered.
5. Run the fixture directly, then run the whole package.

Put core DB-rendered interactions in `fixtures/_shared/core_db` so the same
schema source is exercised by both `db_schema_smoke` and
`postgres_schema_smoke`. Use each dialect fixture directory only for behavior
that is truly dialect-specific. Put PostGIS, pgvector, and extension-backed
concrete field/index behavior in package-specific fixtures unless the CI image
installs those extensions.

## Interpreting Failures

- Codegen step failures usually mean the fixture hit an unsupported combination
  or exposed a generator bug.
- TypeScript failures mean generated code did not compile and should usually be
  fixed before adding a skip.
- Idempotence failures include the changed generated files and a first-line diff
  summary. The snapshot intentionally ignores build-info UUIDs and terminal
  newline churn.
- Catalog failures mean a new codegen input was added without a coverage
  decision.

## Tracked Gaps

- `assoc_edge_config.stable_edge_type_ids`: idempotence snapshots normalize UUID
  literals, but they do not yet prove DB-stored association edge type IDs remain
  stable across generations.
- `index.full_text`: Postgres full-text indexes currently generate a repeated
  drop-index migration after apply.
