---
sidebar_position: 8
---

# gqlConnection

`gqlConnection` is the [type](/docs/custom-graphql/gql-field#type) of a [`gqlField`](/docs/custom-graphql/gql-field) to indicate that it should be exposed as a [GraphQL Connection](https://graphql.org/learn/pagination/#complete-connection-model) on the source object that follows the [Relay Spec](https://relay.dev/graphql/connections.htm).

It takes the name of the node that's going to be at the end of the connection.

Usually used to [query the database in custom ways](/docs/custom-queries/custom-queries).

It expects the method to return a Custom [EntQuery](/docs/core-concepts/ent-query) otherwise things won't work.


For example:

```ts title="src/account.ts"
export class Account extends AccountBase {

@gqlField({ name: "openTodos", type: gqlConnection("Todo") })
  openTodos() {
    return new AccountToOpenTodosQuery(this.viewer, this);
  }
}
```
