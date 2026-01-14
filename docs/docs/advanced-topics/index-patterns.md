---
sidebar_position: 6
sidebar_label: "Index Patterns"
---

# Performance indexes for grouped and assoc edge queries

This doc summarizes index patterns that match the query shapes built in
`ts/src/core/ent.ts` and `ts/src/core/loaders/*` (notably `buildGroupQuery`,
`QueryLoader`, `AssocEdgeLoader`, and `RawCountLoader`).

## Grouped/window queries (`buildGroupQuery`)

`buildGroupQuery` (in `ts/src/core/ent.ts`) generates a window query:

```
SELECT ... row_number() OVER (PARTITION BY groupCol ORDER BY <orderby>) ...
```

It is used by `QueryLoader` (`ts/src/core/loaders/query_loader.ts`) and
`AssocEdgeLoader` (`ts/src/core/loaders/assoc_edge_loader.ts`) when batching
multiple ids.

Index pattern:
- `(groupCol, orderby_col1 [DESC], orderby_col2 [ASC], ...)`
- If you want a covering index, include the remaining selected fields.
  In Postgres use `INCLUDE (...)`; in SQLite append the extra columns.
- `buildGroupQuery` always applies `WHERE groupCol IN (...)` and may append
  additional filter clauses; add commonly-used filter columns (e.g. soft-delete)
  or use partial indexes so the index matches the full predicate, not just the
  grouping and sort.

Example (default QueryLoader order, only when `orderby` is not provided):
- `CREATE INDEX ON <table> (user_id, created_at DESC);`

## Assoc edge queries

Edge queries in `ts/src/core/ent.ts` and `ts/src/core/loaders/assoc_edge_loader.ts`
filter by `edge_type` plus `id1` or `id2`, and often order by `time DESC`.

Recommended patterns:
- List edges for `id1` with ordering:
  `edge_type = ? AND id1 IN (...) ORDER BY time DESC`
  -> `(edge_type, id1, time DESC)`
- Lookups for `id2` with ordering:
  `edge_type = ? AND id2 = ? ORDER BY time DESC`
  -> `(edge_type, id2, time DESC)`
- Direct pair lookups (`loadEdgeForID2`, `getEdgeTypeInGroup`):
  `edge_type = ? AND id1 = ? AND id2 = ?`
  -> `(edge_type, id1, id2)` (or `(edge_type, id2, id1)` if id2 is primary)

Keep the leading columns aligned with the filters (`edge_type`, `id1`/`id2`),
and add `time` last when you want to satisfy the sort.

## Count/group queries

`RawCountLoader` (`ts/src/core/loaders/raw_count_loader.ts`) and
`AssocEdgeCountLoader` (`ts/src/core/loaders/assoc_count_loader.ts`) run:

```
SELECT count(1), groupCol
FROM <table>
WHERE groupCol IN (...) AND <filters>
GROUP BY groupCol
```

Index pattern:
- `(groupCol, <filtered columns...>)`
- Example: `(user_id, edge_type)` or `(user_id, deleted_at)`

If a filter column is more selective than `groupCol`, you can consider swapping
the order, but only when the filter is an equality predicate and highly
selective; otherwise keep `groupCol` first to avoid degrading the `IN (...)`
access pattern.

## Postgres vs SQLite + verification

- Postgres can use `INCLUDE` for covering indexes and honors DESC order for
  index scans; this can avoid explicit sorts in the window query.
- SQLite does not support `INCLUDE`; make the index covering by appending
  columns, and verify whether the planner still uses a temp B-tree for the
  window order.
- Validate with `EXPLAIN` / `EXPLAIN ANALYZE` (Postgres) or
  `EXPLAIN QUERY PLAN` (SQLite) on the concrete SQL produced by
  `buildGroupQuery` or the loaders.
