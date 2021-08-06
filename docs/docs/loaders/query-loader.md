---
sidebar_position: 3
sidebar_label: "QueryLoader"
---

# QueryLoader

QueryLoader is a [`Loader`](/docs/loaders/loader) which is used to fetch multiple rows in the database.

It's used by [index based queries](/docs/core-concepts/ent-query#index-based-query) as well as [custom ent queries](/docs/custom-queries/custom-queries#custom-entquery).

## QueryLoaderFactory

Public Facing [LoaderFactory](/docs/loaders/loader#loaderfactory) of `QueryLoader` used to create new instances of `QueryLoader` as needed.

## API

```ts
interface QueryOptions {
    fields: string[];
    tableName: string;
    groupCol?: string;
    clause?: clause.Clause;
    sortColumn?: string;
    toPrime?: ObjectLoaderFactory<ID>[];
}
class QueryLoaderFactory<K extends any> implements LoaderFactory<K, Data[]> {
    constructor(options: QueryOptions);
}
```

* `fields`: columns in the database to query for.
* `tableName`: relevant table in the database.
* `groupCol`: column in the database that can be converted into an [IN query](https://www.w3schools.com/sql/sql_in.asp) when querying for multiple sources
* `clause`: [Clause](/docs/advanced-topics/clause) instance for filtering.
* `sortColumn`: optional. Column in the database to sort by. If not provided, uses the `created_at` field.
* `toPrime`: optional. Other loaders that can be primed by the result of this query with the result stored in the [context cache](/docs/core-concepts/context-caching).

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

* open todos of a user. can be used to fetch multiple users at a time

```ts
const openTodosLoader = new QueryLoaderFactory({
  ...Todo.loaderOptions(),
  groupCol: "creator_id",
  clause: query.Eq("completed", false),
  toPrime: [todoLoader],
});
```

* open todos of a user. *cannot* be used to fetch multiple users at a time

```ts
const openTodosLoader = new QueryLoaderFactory({
  ...Todo.loaderOptions(),
  groupCol: "creator_id",
  clause: query.And(query.Eq("creator_id", user.id, query.Eq("completed", false)),
  toPrime: [todoLoader],
});
```

* all todos of a user. can be used to fetch multiple users at a time

```ts
const allTodosLoader = new QueryLoaderFactory({
  ...Todo.loaderOptions(),
  groupCol: "creator_id",
  toPrime: [todoLoader],
});
```

* all todos of a user. *cannot* be used to fetch multiple users at a time

```ts
const allTodosLoader = new QueryLoaderFactory({
  ...Todo.loaderOptions(),
  clause: query.Eq("creator_id", user.id),
  toPrime: [todoLoader],
});
```
