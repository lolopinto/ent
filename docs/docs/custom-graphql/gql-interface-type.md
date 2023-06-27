---
sidebar_position: 10
---

# gqlInterfaceType

Adds a new [GraphQL interface](https://graphql.org/learn/schema/#interfaces) to the schema.

Until [this bug](https://github.com/microsoft/TypeScript/issues/53332) is fixed, custom interfaces need to be defined in a separate file from where they're consumed.

Options:

* name

Name of the interface type. If not specified, defaults to the name of the class.

* description

Description of the interface. Will be added to the Schema and exposed in tools like [GraphiQL](https://github.com/graphql/graphiql) or [Playground](https://github.com/graphql/graphql-playground).

```ts
@gqlInterfaceType({})
export class ContactItem {
  @gqlField({
    class: "ContactItem",
    type: "ContactLabel",
  })
  label: ContactLabel;

  @gqlField({
    class: "ContactItem",
    type: GraphQLString,
  })
  description: string;

  constructor(
    label: ContactLabel,
    description: string,
  ) {
    this.label = label;
    this.description = description;
  }
}
```

In this example, we add a new interface type `ContactItem` which has 2 fields: `label`, `description`.
