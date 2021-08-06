---
sidebar_position: 6
---

# gqlContextType

`gqlContextType` annotates a method to indicate that it needs the [RequestContext](/docs/core-concepts/context#requestcontext) and the generated GraphQL code should pass it down to the method.

It's required to be the first argument to the method. It can be used in custom [queries](/docs/custom-graphql/custom-queries) or [mutations](/docs/custom-graphql/custom-mutations).

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
