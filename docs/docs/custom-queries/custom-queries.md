---
sidebar_position: 1
---

# Custom Queries

The generated code and APIs that exist often aren't enough and you'll want to perform custom queries to access your data in the database.

There are multiple ways of doing this:

* load all ents with privacy checks with `EntName.loadCustom`
* load all raw data with `EntName.loadCustomData`
* load [EntQuery](/docs/core-concepts/ent-query) with pagination, filtering, ordering and all the bells and whistles of the generated queries.

We'll be using the following schema in all the examples below:

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

## CustomQuery

Each Ent has generated static methods `loadCustom` and `loadCustomData` which take `CustomQuery` which can be used to customize the query sent to the database.

```ts
declare type CustomQuery = string | rawQueryOptions | clause.Clause | QueryDataOptions;
```

### query with string

To query all completed todos in the schema, you can do the following:

```ts
// sqlite query
const closedTodos = await Todo.loadCustom(
    account.viewer,
   `SELECT * FROM todos where completed = 1`,
 );

// postgres
const closedTodos = await Todo.loadCustom(
    account.viewer,
   `SELECT * FROM todos where completed = true`,
 );
```

### query with clause

To query all open todos of a user:

```ts
const openTodos = await Todo.loadCustom(
  account.viewer,
  query.And(query.Eq("creator_id", account.id), query.Eq("completed", false)),
);
```

### query with raw parameterized query

```ts
// sqlite
// like the first example but using prepared queries
const closedTodos = await Todo.loadCustom(account.viewer, {
    query: `SELECT * FROM todos where completed = ?`,
    values: [1],
  });

// postgres
const closedTodos = await Todo.loadCustom(account.viewer, {
    query: `SELECT * FROM todos where completed = $1`,
    values: [true],
  });
```

This uses [prepared queries](https://en.wikipedia.org/wiki/Prepared_statement).

### query and orderby

```ts
const orderedOpenedTodos = await Todo.loadCustom(account.viewer, {
    clause: query.And(
      query.Eq("creator_id", account.id),
      query.Eq("completed", false),
    ),
    orderby: "created_at desc",
  });
```

Other options supported here are:

```ts
interface QueryDataOptions {
    distinct?: boolean;
    clause: clause.Clause;
    orderby?: string;
    groupby?: string;
    limit?: number;
}
```

### loadCustomData

Any of the above can be used with `loadCustomData` instead of `loadCustom` to just fetch the raw data instead of the ents:

```ts
const closedTodos: Data[] = await Todo.loadCustomData({
    clause: query.Eq("completed", false),
    query: `SELECT * FROM todos where completed = ?`,
    values: [1],
  });
```

### expose to graphql

To expose the Ent accessors above to GraphQL as a [list](https://graphql.org/learn/schema/#lists-and-non-null), use [gqlField](/docs/custom-graphql/gql-field).

```ts title="src/account.ts"
export class Account extends AccountBase {

@gqlField({ name: "openTodosPlural", type: "[Todo]" })
  async openTodosPlural() {
    return await Todo.loadCustom(
      this.viewer,
      query.And(query.Eq("creator_id", this.id), query.Eq("completed", false)),
    );
  }
```

## Custom EntQuery

Fetching all objects in a custom query isn't always desired because as usage of your application grows, the amount of data that could be returned is a lot. We provide the ability to return an [EntQuery](/docs/core-concepts/ent-query) which can be exposed as a GraphQL [Connection](https://graphql.org/learn/pagination/#complete-connection-model) that follows the [Relay Spec](https://relay.dev/graphql/connections.htm).

To do so, we need to be aware of the following concepts:

* [CustomEdgeQueryBase](#custom-entquery)
* [RawCountLoaderFactory](/docs/loaders/raw-count-loader#rawcountloaderfactory)
* [QueryLoaderFactory](/docs/loaders/query-loader#queryloaderfactory)

Here's what the end product looks like here:

```ts title="src/ent/account.ts"

const openTodosLoader = new QueryLoaderFactory({
  ...Todo.loaderOptions(),
  // or tableName: Todo.loaderOptions().tableName
  groupCol: "creator_id",
  clause: query.Eq("completed", false),
  toPrime: [todoLoader],
});

const openTodosCountLoader = new RawCountLoaderFactory({
  ...Todo.loaderOptions(),
  // or tableName: Todo.loaderOptions().tableName
  groupCol: "creator_id",
  clause: query.Eq("completed", false),
});

export class AccountToOpenTodosQuery extends CustomEdgeQueryBase<Todo> {
  constructor(viewer: Viewer, src: ID | Account) {
    super(viewer, {
      src,
      countLoaderFactory: openTodosCountLoader,
      dataLoaderFactory: openTodosLoader,
      options: Todo.loaderOptions(),
    });
  }
}
```

### CustomEdgeQueryBase

This is the base class of a custom EntQuery that needs to be implemented. This is what's used by the generated [index based queries](/docs/core-concepts/ent-query#index-based-query).

The relevant API is as follows:

```ts
interface CustomEdgeQueryOptions<T extends Ent> {
    src: Ent | ID;
    countLoaderFactory: LoaderFactory<ID, number>;
    dataLoaderFactory: ConfigurableLoaderFactory<ID, Data[]>;
    options: LoadEntOptions<T>;
    sortColumn?: string;
}

declare class CustomEdgeQueryBase<TDest extends Ent> extends BaseEdgeQuery<TDest, Data> {
    constructor(viewer: Viewer, options: CustomEdgeQueryOptions<TDest>);
}
```

CustomEdgeQueryOptions has the following properties:

* `src`: The source ent of the query
* `countLoaderFactory`: [LoaderFactory](/docs/loaders/loader#loaderfactory) used to get the `rawCount`
* `dataLoaderFactory`: [LoaderFactory](/docs/loaders/loader#loaderfactory) used to get the data at the end of the query
* `options`: used to load the ents at the end of the query. The generated `Ent.loaderOptions()` method suffices here
* `sortColumn`: optional. Column in the database to sort by. If not provided, uses the `created_at` field.

### expose query to graphql

To expose the custom ent query above to GraphQL as a connection, use [`gqlConnection`](/docs/custom-graphql/gql-connection).

```ts title="src/account.ts"
export class Account extends AccountBase {

@gqlField({ name: "openTodos", type: gqlConnection("Todo") })
  openTodos() {
    return new AccountToOpenTodosQuery(this.viewer, this);
  }
}
```
