---
sidebar_position: 1
---

# Custom Accessors

We briefly showed how to add [custom functionality](/docs/core-concepts/ent#custom-functionality) in an object but didn't show how to expose it in GraphQL to end users. This explains how to do so.

Given the following schema:

```ts title="src/schema/user_schema.ts"
import { EntSchema, StringType } from "@snowtop/ent"; 
import { EmailType } from "@snowtop/ent-email"; 
import { PasswordType } from "@snowtop/ent-password"; 

const UserSchema = new EntSchema({
  fields: {

    FirstName: StringType(),
    LastName: StringType(),
    EmailAddress: EmailType(),
    Password: PasswordType(),

  }
}); 
export default UserSchema; 

```

we'll end with the following GraphQL schema:

```ts title="src/graphql/generated/schema.gql"

type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
}
```

Even after the custom method `howLong` is added below, it's not exposed to the GraphQL schema yet.

```ts title="src/ent/user.ts"
import { UserBase } from "src/ent/internal"; 
import { AlwaysAllowPrivacyPolicy, ID, LoggedOutViewer, PrivacyPolicy } from "@snowtop/ent"
import { Interval } from "luxon"; 

export class User extends UserBase {
  getPRivacyPolicy() {

    return AlwaysAllowPrivacyPolicy;

  }

  howLong() {

    return Interval.fromDateTimes(this.createdAt, new Date()).count('seconds');

  }
}
```

To do so, we'll dive into the Custom GraphQL API.

We use [TypeScript Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html) to annotate methods to indicate what we're exposing to GraphQL.

These decorators are evaluated during code generation and they do as little as possible (nothing) otherwise to reduce the overhead of using them.

[gqlField](/docs/custom-graphql/gql-field) is how we annotate the property or method to expose in GraphQL.
