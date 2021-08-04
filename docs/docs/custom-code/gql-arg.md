---
sidebar_position: 7
---

# gqlArg

`gqlArg` annotates an argument to a method to indicate that it's an [argument](https://graphql.org/learn/schema/#arguments) of a GraphQL field.

For example:

```ts title="src/graphql/mutations/auth.ts"

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

updates the GraphQL schema as follows:

```graphql title="src/graphql/schema.gql"

type Mutation {
  userAuth(input: UserAuthInput!): UserAuthPayload!
}
```

and the generated code looks like:

```ts title="src/graphql/mutations/generated/user_auth_type.ts"
export const UserAuthType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: UserAuthInput }
> = {
  // ...
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<UserAuthPayload> => {
    const r = new AuthResolver();
    return r.userAuth(context, {
      emailAddress: input.emailAddress,
      password: input.password,
    });
  },
};
```
