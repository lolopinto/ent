# ent-semantic-notes

Example schema and query module that uses the shared DB extension stack plus
`@snowtop/ent-pgvector` to model semantic note chunks with nearest-neighbor
search.

Concepts covered:
- database-level extension declaration via `dbExtensions`
- `vector(n)` field generation
- semantic nearest-neighbor query helpers
- ent relationships for workspaces, notes, tags, and note chunks
- semantic search ordered by vector similarity

This example assumes PostgreSQL with the `vector` extension available. The
included `docker-compose.dev.yml` uses a pgvector-enabled Postgres image so
`npm run upgrade` can manage the extension plus the tables and HNSW index in
the same migration flow. Run `npm run db:up` before using `npm run codegen` or
`npm run upgrade` from this repo checkout.

The package also includes `HNSWIndex()` and `IVFFlatIndex()` helpers, but this example
keeps the schema portable to older local pgvector installs by not requiring ANN access
methods during setup.
