---
sidebar_position: 8
---

# gqlObjectType

Adds a new object to the schema. See example [usage](/docs/custom-graphql/custom-queries#viewer).


Options:

* name

Name of the object. If not specified, defaults to the name of the class

* description

Description of the object. Will be added to the Schema and exposed in tools like [GraphiQL](https://github.com/graphql/graphiql) or [Playground](https://github.com/graphql/graphql-playground).

* interfaces

[Custom interfaces](/docs/custom-graphql/gql-interface-type) that this object should implement.
