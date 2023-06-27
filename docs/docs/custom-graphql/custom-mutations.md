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
  @gqlField({
    class: 'UserAuthInput',
    type: GraphQLString,
  })
  emailAddress: string;

  @gqlField({
    class: 'UserAuthInput',
    type: GraphQLString,
  })
  password: string; 

  constructor(emailAddress: string, password: string) {
    this.emailAddress = emailAddress;
    this.password = password;
  }
}

@gqlObjectType()
export class UserAuthPayload {
  @gqlField({     
    class: "UserAuthPayload", 
    type: GraphQLID,
  })
  viewerID: ID; 

  constructor(viewerID: ID) {
    this.viewerID = viewerID;
  }
}

export class AuthResolver {
  @gqlMutation({ 
    class: "AuthResolver",
    name: "userAuth", 
    type: UserAuthPayload,
    async: true,
    args: [
      gqlContextType(),
      {
        name: "input",
        type: "UserAuthInput",
      },
    ]
  })
  async userAuth(
    context: RequestContext,
    input: UserAuthInput,
  ): Promise<UserAuthPayload> {
    return new UserAuthPayload("1");
  }
}

```

This updates the GraphQL schema as follows:

```graphql title="src/graphql/generated/schema.gql"

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

* [gqlMutation](#gqlmutation)
* [gqlInputObjectType](/docs/custom-graphql/gql-input-object-type)
* [gqlField](/docs/custom-graphql/gql-field)
* [gqlObjectType](/docs/custom-graphql/gql-object-type)
* [gqlContextType](/docs/custom-graphql/gql-context)

## gqlMutation

This adds a new field to the GraphQL `Mutation` type. See example usage [above](#auth-example).

Accepts the following options which overlap with [gqlField](/docs/custom-graphql/gql-field):

* `class` for the name of the class the function is defined in.
* `name` for the name of the GraphQL field
* `description` of the field
* `type`: type returned by the field
