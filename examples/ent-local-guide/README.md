# ent-local-guide

Example schema and query module that uses `dbExtensions` plus
`@snowtop/ent-postgis` to model places, reviews, favorites, and nearby place
search.

Concepts covered:
- database-level PostGIS extension declaration
- `geography(Point,4326)` field generation
- GIST index metadata for spatial queries
- distance selection, radius filtering, and nearest-first ordering
- ordinary ent features alongside spatial data: creator ownership, reviews, and favorites

This example expects PostgreSQL with PostGIS available. The included
`docker-compose.dev.yml` builds a local Postgres image with the PostGIS packages
installed so `npm run upgrade` can create the extension and schema objects
together. Run `npm run db:up` before using `npm run codegen` or `npm run upgrade`
from this repo checkout. The focused Jest test proves the generated nearby-search
SQL shape.
