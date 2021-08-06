---
sidebar_position: 4
---

# Custom Mutations

As a product gets more complicated, the need to eventually add custom [mutations](https://graphql.org/learn/schema/#the-query-and-mutation-types) to the schema arises. This shows how to do so.

## Auth Example

A common thing for a lot of applications is to implement authentication to log the user in. This shows a possible way to implement it:

```ts title="src/graphql/mutations/auth.ts"
@gqlInputObjectType()
export class UserAuthInput {
  @gqlField()
  emailAddress: string;
  @gqlField()
  password: string;
}

@gqlObjectType()
export class UserAuthPayload {
  @gqlField({ type: GraphQLID })
  viewerID: ID;
}


export class AuthResolver {
  @gqlMutation({ name: "userAuth", type: UserAuthPayload })
  async userAuth(
    @gqlContextType() context: RequestContext,
    @gqlArg("input") input: UserAuthInput,
  ): Promise<UserAuthPayload> {
    return {viewerID : "1"};
  }
}
```

This updates the GraphQL schema as follows:

```graphql title="src/graphql/schema.gql"

type Mutation {
  userAuth(input: UserAuthInput!): UserAuthPayload!
}

type UserAuthPayload {
  viewerID: ID!
}

input UserAuthInput {
  emailAddress: String!
  password: String!
}
```

Here's what's happening here:

* This adds a new [input type](https://graphql.org/learn/schema/#input-types) `UserAuthInput` to the GraphQLSchema represented by the class `UserAuthInput`.
* `UserAuthInput` object has 2 fields:
  * `emailAddress` of type `String`
  * `password` of type `String`
* This adds a new [object type](https://graphql.org/learn/schema/#object-types-and-fields) `UserAuthPayload` to the GraphQLSchema represented by the class `UserAuthPayload`
* `UserAuthPayload` object has 1 field:
  * `viewerID` of type `ID`
* New field `userAuth` added to `Mutation` Type which takes `UserAuthInput` input and returns `UserAuthPayload`.

This uses the following concepts to implement this:

* [gqlMutation](#gqlMutation)
* [gqlInputObjectType](#gqlInputObjectType)
* [gqlField](/docs/custom-graphql/gql-field)
* [gqlObjectType](#gqlObjectType)
* [gqlContextType](/docs/custom-graphql/gql-context)
* [gqlArg](/docs/custom-graphql/gql-arg)

## gqlMutation

This adds a new field to the GraphQL `Mutation` type. See example usage [above](#auth-example).

Accepts the following options which overlap with [gqlField](/docs/custom-graphql/gql-field):

* `name` for the name of the GraphQL field
* `description` of the field
* `type`: type returned by the field

## gqlInputObjectType

Adds a new input object to the schema. See example usage [above](#auth-example).

Options:

### name

Name of the input object. If not specified, defaults to the name of the class.

### description

Description nof the input object. Will be added to the Schema and exposed in tools like [GraphiQL](https://github.com/graphql/graphiql) or [Playground](https://github.com/graphql/graphql-playground).

## gqlObjectType

Adds a new object to the schema. See example usage [above](#auth-example).

Options:

### name

Name of the object. If not specified, defaults to the name of the class

### description

Description nof the object. Will be added to the Schema and exposed in tools like [GraphiQL](https://github.com/graphql/graphiql) or [Playground](https://github.com/graphql/graphql-playground).
