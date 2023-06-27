---
sidebar_position: 2
---

# gqlField

`gqlField` annotates a property or method to indicate that it should be exposed as a GraphQL Field on the source object.

For example, to expose `howLong` as a non-nullable integer on the `User` object, we do the following:

```ts title="src/ent/user.ts"
export class User extends UserBase {
  @gqlField({
    class: 'User',
    type: GraphQLInt,
  })
  howLong(): number {
    return Interval.fromDateTimes(this.createdAt, new Date()).count('seconds')
  }
}

```

which updates the GraphQL schema as follows:

```ts title="src/graphql/generated/schema.gql"

type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  howLong: Int!
}
```

To expose `fullName` as a string either as a property or a method, we can do the following:

```ts title="src/ent/user.ts"
export class User extends UserBase {

  @gqlField({
    class: 'User',
    type: GraphQLString,
  })
  get fullName(): string {
    return this.firstName + " " + this.lastName;
  }

  // OR 

  @gqlField({
    class: 'User',
    type: GraphQLString,
  })
  fullName(): string {
    return this.firstName + " " + this.lastName;
  }
}

```

which updates the GraphQL schema as follows:

```ts title="src/graphql/generated/schema.gql"
type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  fullName: String!
}
```

gqlField supports a few options which we'll go into below.

## class

Used to associate this field with the class the function/property is in since the TypeScript decorator API doesn't provide this information. It should be the name of the TypeScript class as opposed to the name of the GraphQL object if they're different.

## args

Indicates arguments of the function which will be converted to GraphQL field [arguments](https://graphql.org/learn/schema/#arguments) on the generated GraphQL field.

### gqlFieldArg

A simplified definition of `gqlFieldArg`'s API is:

```ts
interface gqlFieldArg {
  name: string;
  nullable?: boolean | NullableListOptions;
  description?: string;
  type?: Type | Array<Type> | GraphQLConnection<Type>; // types or lists of types
}
```

`nullable`, `description` and `type` are similar to the values passed to `gqlField` and will be discussed later in this section.

An example usage is as follows:

```ts
class User {
  @gqlField({
    class: "User",
    type: "[Contact]",
    name: "contactsGivenDomain",
    args: [
      {
        name: "domain",
        type: GraphQLString,
      },
    ],
    async: true,
  })
  async getContactsGivenDomain(domain: string): Promise<Contact[]> {
    return [];
  }
}
```

### gqlContextType

[`gqlContextType`](/docs/custom-graphql/gql-context) annotates a method to indicate that it needs the [RequestContext](/docs/core-concepts/context#requestcontext) and the generated GraphQL code should pass it down to the method.

It's a pre-defined `gqlFieldArg` because it'll be used so often in custom queries and mutations.

## type

Indicates the GraphQL type of the field.

```ts
interface ClassType<T = any> {
    new (...args: any[]): T;
}

export interface CustomType {
    type: string;
    importPath: string;
    tsType?: string;
    tsImportPath?: string;
}

export type GraphQLConnection<T> = { node: T };

declare type Type = GraphQLScalarType | ClassType | string | CustomType;

interface gqlFieldOptions {
  type: Type | Array<Type> | GraphQLConnection<Type>; // types or lists of types or GraphQLConnectionType
}
```

Supported type formats:

### GraphQLScalarType

`GraphQLScalarType` refers to a GraphQL Scalar like `GraphQLInt` , `GraphQLFloat` , `GraphQLBoolean` like seen above in `howLong` .

### ClassType

refers to objects such as Ents which are exposed to GraphQL.

For example, this contrived example:

```ts
class User {
  @gqlField({ class: 'User', type: User, name: "self", async: true })
  async loadSelf(): Promise<User> {
    return new User();
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/generated/schema.gql"
type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  self: User!
}

```

And the list version:

```ts
class User {
  @gqlField({ class: 'User', type: [User], name: "selves", async: true })
  async loadSelf(): Promise<User[]> {
    return [new User()];
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/generated/schema.gql"
type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  selves: [User!]!
}

```

### string

refers to the names of objects such as Ents which are exposed to GraphQL. This is usually needed in weird cases where there's circular-ish references between classes and the object isn't in scope. We're not going to dive into the intricacies here but this provides a workaround in that scenario.

For example:

```ts
class User {
  @gqlField({
    class: 'User',
    async: true,
    type: "Contact",
    nullable: true,
    name: "contactSameDomain",
  })
  async getFirstContactSameDomain(): Promise<Contact | null> {
    return null;
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/generated/schema.gql"
type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  contactSameDomain: Contact
}

```

To provide the list version of this:

```ts
class User {
  @gqlField({ 
    class: 'User',
    type: "[Contact]", 
    name: "contactsSameDomain",
    async: true,
  })
  async getContactsSameDomain(): Promise<Contact[]> {
    return [];
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/generated/schema.gql"
type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  contactsSameDomain: [Contact!]!
}

```

### CustomType

This allows the flexibility for custom types that are not the built-in GraphQL Scalar Types.

We'll dive into a specific example of this in [gqlFileUpload](/docs/custom-graphql/file-uploads#gqlfileupload).

## name

Indicates the name of the GraphQL field. Should be used when we want a different name than the name of the function, method or property.

## description

Indicates the description of the GraphQL field. Will be added to the Schema and exposed in tools like [GraphiQL](https://github.com/graphql/graphiql) or [Playground](https://github.com/graphql/graphql-playground).

## nullable

Indicates this field is nullable.

If `true` and a list, means the list is nullable even if the contents of the list isn't:

```ts
class User {
  @gqlField({ 
    class: "User",
    type: "[Contact]", 
    name: "contactsSameDomain", 
    nullable: true,
    async: true 
  })
  async getContactsSameDomain(): Promise<Contact[] | null> {
    return [];
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/generated/schema.gql"
type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  contactsSameDomain: [Contact!]
}

```

If not `true` and a list, there are two other options:

### contents

Indicates that the contents of the list is nullable.

```ts
class User {
  @gqlField({ 
    class: "User",
    type: "[Contact]", 
    name: "contactsSameDomain", 
    nullable: "contents",
    async: true
  })
  async getContactsSameDomain(): Promise<(Contact | null)[]> {
    return [];
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/generated/schema.gql"
type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  contactsSameDomain: [Contact]!
}

```

### contentsAndList

Indicates that both the list and its contents are nullable.

```ts
class User {
  @gqlField({ 
    class: "User",
    type: "[Contact]", 
    name: "contactsSameDomain", 
    nullable: "contents",
    async: true,
  })
  async getContactsSameDomain(): Promise<(Contact | null)[] | null> {
    return [];
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/generated/schema.gql"
type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  contactsSameDomain: [Contact]
}
```

View the [GraphQL documentation](https://graphql.org/learn/schema/#lists-and-non-null) to learn more about lists and null in GraphQL.

## async

Indicates that this method is async and an async caller should be generated in the generated GraphQL code.
