# README

Simple TODO app using SQLite.

Extra methods gotten from the [relay example](https://github.com/relayjs/relay-examples/blob/master/todo/data/schema.graphql).

Run locally:

```shell
 DB_CONNECTION_STRING=sqlite:///todo.db tsent codegen
 ```

## v0.1 migration guide

* run command:

```shell
DB_CONNECTION_STRING=sqlite:///ent-starter.db tsent migrate_v0.1  --old_base_class BaseEntTodoSchema --new_schema_class TodoEntSchema  --transform_path src/schema/patterns/base
```

* fix schema imports in
  * `src/ent/account.ts`
  * `src/graphql/resolvers/open_todos.ts`

* rerun migration command above

* tsc
* jest
