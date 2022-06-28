---
sidebar_position: 7
---

# Enums

Enums can be configured in three different ways.

## strings

This is the default behavior for enum types because it's easy and not complicated. It's configured as follows:

```ts
  EnumType({
    name: "Rainbow",
    hideFromGraphQL: true,
    values: ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'],
  })
```

This adds a string column of type rainbow to the table and enforces when saving that field that the only acceptable values are the provided values.

Since the recommended values for GraphQL Enums are [all caps](http://spec.graphql.org/draft/#sec-Enum-Value), it transforms the provided values into a graphql enum type with all caps.

## postgres enum type

Postgres has support for built in [enum type](https://www.postgresql.org/docs/9.1/datatype-enum.html) which may be preferred to using strings. This provides database validation/enforcement that only valid values can be input as opposed to leaving it to the ent-or data layer.

These types [can't](https://github.com/lolopinto/ent/pull/113) be changed [easily](https://github.com/lolopinto/ent/pull/120) so we don't currently support changing this.

Configured as follows:

```ts
  EnumType({
    name: "Rainbow",
    hideFromGraphQL: true,
    values: ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'],
    createEnumType: true, // magic line 
  }),
```

results in the following db change:

```db
ent-test=# \dT+ rainbow
                                      List of data types
 Schema |  Name   | Internal name | Size | Elements | Owner | Access privileges | Description 
--------+---------+---------------+------+----------+-------+-------------------+-------------
 public | rainbow | rainbow       | 4    | red     +| ola   |                   | 
        |         |               |      | orange  +|       |                   | 
        |         |               |      | yellow  +|       |                   | 
        |         |               |      | green   +|       |                   | 
        |         |               |      | blue    +|       |                   | 
        |         |               |      | indigo  +|       |                   | 
        |         |               |      | violet   |       |                   | 
(1 row)
```

## lookup tables

```ts title="src/schema/request_status.ts"
export default class RequestStatus implements Schema {
  fields: Field[] = [
    StringType({
      name: "status",
      primaryKey: true,
    }),
  ];

  enumTable = true;

  dbRows = [
    {
      status: "OPEN",
    },
    {
      status: "PENDING_FULFILLMENT",
    },
    {
      status: "CLOSED",
    },
  ];
}
```

The schema above generates the following:
database table named `request_statuses` with 3 rows: `OPEN`, `PENDING_FULFILLMENT`, `CLOSED`

import DatabaseTabs from "../../src/components/DatabaseTabs";
import PostgresEnums from "./postgres_enums.txt";
import SqliteEnums from "./sqlite_enums.txt";

<DatabaseTabs postgres={PostgresEnums} sqlite={SqliteEnums} />

TypeScript enum `RequestStatus`:

```ts
export enum RequestStatus {
  OPEN = "OPEN",
  PENDING_FULFILLMENT = "PENDING_FULFILLMENT",
  CLOSED = "CLOSED",
}
```

and the following GraphQL enum

```graphql
enum RequestStatus {
  OPEN
  PENDING_FULFILLMENT
  CLOSED
}
```

To reference this enum in a different schema, use as follows:

```ts
  EnumType({
    name: "Status",
    foreignKey: ["RequestStatus", "status"],
  })
```
