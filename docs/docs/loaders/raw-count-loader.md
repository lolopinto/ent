---
sidebar_position: 2
sidebar_label: "RawCountLoader"
---

# RawCountLoader

RawCountLoader is a [`Loader`](/docs/loaders/loader) which is used to generate the rawCount for the number of rows in the database.

It's used by [index based queries](/docs/core-concepts/ent-query#index-based-query) as well as [custom ent queries](/docs/custom-queries/custom-queries#custom-entquery).

## RawCountLoaderFactory

Public Facing [LoaderFactory](/docs/loaders/loader#loaderfactory) of `RawCountLoader` used to create new instances of `RawCountLoader` as needed.

## API

```ts
interface QueryCountOptions {
    tableName: string;
    groupCol?: string;
    clause?: clause.Clause;
}
declare class RawCountLoader<K extends any> implements Loader<K, number> {
    context?: Context | undefined;
    constructor(options: QueryCountOptions, context?: Context | undefined);
}
declare class RawCountLoaderFactory implements LoaderFactory<ID, number> {
    name: string;
    constructor(options: QueryCountOptions);
    createLoader(context?: Context): any;
}
```

* `tableName`: relevant table in the database.
* `groupCol`: column in the database that can be converted into an [IN query](https://www.w3schools.com/sql/sql_in.asp) when querying for multiple sources
* `clause`: [Clause](/docs/advanced-topics/clause) instance for filtering.

Note that at least one of `groupCol` and `clause` must be provided.

## Examples

Given the following schema,

```ts title="src/schema/todo.ts"
export default class Todo extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "Text" }),
    BooleanType({
      name: "Completed",
      index: true,
      defaultValueOnCreate: () => {
        return false;
      },
    }),
    UUIDType({
      name: "creatorID",
      foreignKey: { schema: "Account", column: "ID" },
    }),
  ];
}
```

here are some examples:

* count of open todos of a user. can be used to fetch multiple users at a time

```ts
const openTodosCountLoader = new RawCountLoaderFactory({
  tableName: Todo.loaderOptions().tableName,
  groupCol: "creator_id",
  clause: query.Eq("completed", false),
});
```

generates query like this

```sql
SELECT count(1) as count FROM todos WHERE creator_id IN ($1, $2, $3) AND completed = $4 GROUP BY creator_id;
```

* count of open todos of a user. *cannot* be used to fetch multiple users at a time

```ts
const openTodosCountLoader = new RawCountLoaderFactory({
  tableName: Todo.loaderOptions().tableName,
  clause: query.And(query.Eq("creator_id", user.id, query.Eq("completed", false)),
});
```

generates query like this

```sql
SELECT count(1) as count FROM todos WHERE creator_id = $1 AND completed = $2;
```

* count of all todos of a user. can be used to fetch multiple users at a time

```ts
const allTodosCountLoader = new RawCountLoaderFactory({
  tableName: Todo.loaderOptions().tableName,
  groupCol: "creator_id",
});
```

generates query like this

```sql
SELECT count(1) as count FROM todos WHERE creator_id IN ($1, $2, $3) GROUP BY creator_id;
```

* count of all todos of a user. *cannot* be used to fetch multiple users at a time

```ts
const allTodosCountLoader = new RawCountLoaderFactory({
  tableName: Todo.loaderOptions().tableName,
  clause: query.Eq("creator_id", user.id),
});
```

generates query like this

```sql
SELECT count(1) as count FROM todos WHERE creator_id = $1;
```
