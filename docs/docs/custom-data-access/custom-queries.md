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

```ts title="src/schema/todo_schema.ts"
const TodoSchema = new EntSchema({
  fields: {
    text: StringType(),
    completed: BooleanType({
      index: true,
      defaultValueOnCreate: () => {
        return false;
      },
    }),
    creatorID: UUIDType({
      foreignKey: { schema: "Account", column: "ID" },
    }),
  }, 
}); 
export default TodoSchema; 

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

To query all open todos of an account:

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
    return Todo.loadCustom(
      this.viewer,
      query.And(query.Eq("creator_id", this.id), query.Eq("completed", false)),
    );
  }

```

## Custom EntQuery

Fetching all objects in a custom query isn't always desired because as usage of your application grows, the amount of data that could be returned is a lot. We provide the ability to return an [EntQuery](/docs/core-concepts/ent-query) which can be exposed as a GraphQL [Connection](https://graphql.org/learn/pagination/#complete-connection-model) that follows the [Relay Spec](https://relay.dev/graphql/connections.htm).

Here's an example query to get open todos of an account in a simple TODO app:

```ts title="src/ent/account.ts"

export class AccountToOpenTodosQuery extends CustomEdgeQueryBase<Todo> {
  constructor(viewer: Viewer, src: ID | Account) {
    super(viewer, {
      src,
      groupCol: "creator_id",
      loadEntOptions: Todo.loaderOptions(),
      clause: query.Eq("completed", false),
      name: "account_to_open_todos",
      // optional...
      // sortColumn: 'created_at',
    });
  }
}
```

### CustomEdgeQueryBase

This is the base class of a custom EntQuery that needs to be implemented. This is what's used by the generated [index based queries](/docs/core-concepts/ent-query#index-based-query).

The relevant API is as follows:

```ts
interface CustomEdgeQueryOptions<TSource extends Ent<TViewer>, TDest extends Ent<TViewer>, TViewer extends Viewer = Viewer> {
    src: TSource | ID;
    loadEntOptions: LoadEntOptions<TDest, TViewer>;
    groupCol?: string;
    clause?: Clause;
    name: string;
    sortColumn?: string;
    sortColumnUnique?: boolean;
}

declare class CustomEdgeQueryBase<TDest extends Ent> extends BaseEdgeQuery<TDest, Data> {
  constructor(viewer: TViewer, options: CustomEdgeQueryOptions<TSource, TDest, TViewer>);
}
```

`CustomEdgeQueryOptions` has the following properties:

* `src`: The source ent of the query
* `loadEntOptions`: used to load the ents at the end of the query. The generated `Ent.loaderOptions()` method suffices here
* `groupCol`: column in the database that can be converted into an IN query when querying for multiple sources
* `clause`: [Clause](/docs/advanced-topics/clause) instance for filtering.
* `name`: unique name used to identify this query. Used with [Context Caching](/docs/core-concepts/context-caching).
* `sortColumn`: optional. Column in the database to sort by. If not provided, uses the `id` field.
* `sortColumnUnique`: optional. If provided, `sortColumn` is used in generating the cursors and makes for a simpler SQL query.

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

## Global EntQuery

To fetch a query that isn't source based or that's global to your database e.g. all closed todos in the last day, instead of using `CustomEdgeQueryBase` above, you can use `CustomClauseQuery`. This can also be exposed as a GraphQL [Connection](https://graphql.org/learn/pagination/#complete-connection-model) that follows the [Relay Spec](https://relay.dev/graphql/connections.htm).

```ts

  @gqlQuery({ name: "closed_todos_last_day", type: gqlConnection("Todo") })
  closedTodosLastDay(@gqlContextType() context: RequestContext) {
    const start = Interval.before(new Date(), { hours: 24 })
      .start.toUTC()
      .toISO();

    return new CustomClauseQuery(context.getViewer(), {
      loadEntOptions: Todo.loaderOptions(),
      clause: query.And(
        query.Eq("completed", true),
        query.GreaterEq("completed_date", start),
      ),
      name: "closed_todos_last_day",
      sortColumn: 'completed_date',
    });
  }
```
