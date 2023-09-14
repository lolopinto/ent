---
sidebar_position: 11
---

# gqlUnionType

Adds a new [GraphQL Union](https://graphql.org/learn/schema/#union-types) to the schema.

Options:

* name

Name of the union type. If not specified, defaults to the name of the class.

* description

Description of the union. Will be added to the Schema and exposed in tools like [GraphiQL](https://github.com/graphql/graphiql) or [Playground](https://github.com/graphql/graphql-playground).

* unionTypes

List of union Types.

```ts
@gqlUnionType({
  unionTypes: ["ContactEmail", "ContactPhoneNumber", "ContactDate"],
})
export class ContactItemResult {}
```

In this example, we add a new Union type `ContactItemResult` which could be one of three types: `ContactEmail`, `ContactPhoneNumber`, `ContactDate`.
