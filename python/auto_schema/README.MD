This takes a [sqlalchemy](https://www.sqlalchemy.org/) schema and applies [alembic](https://alembic.sqlalchemy.org/en/latest/) migrations.

It's used by the ent framework on top of  [alembic autogenerate](https://alembic.sqlalchemy.org/en/latest/autogenerate.html) to ensure that all supported schema types are automatically handled.

Will beef up this README eventually and add examples later.

Called as follows: `python3 auto_schema -s={pathToSchema} -e={engineURL}`.

Only supports Postgres DB at the moment.

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
