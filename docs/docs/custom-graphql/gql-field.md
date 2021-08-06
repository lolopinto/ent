---
sidebar_position: 2
---

# gqlField

`gqlField` annotates a property or method to indicate that it should be exposed as a GraphQL Field on the source object.

When a property or method explicitly returns a scalar type and isn't nullable, we can usually infer everything but as things get more complicated, have to specify more options.

We continue with the [example](/docs/custom-graphql/custom-accessors).

```ts title="src/ent/user.ts"
export class User extends UserBase {

  @gqlField()
  howLong() {
    return Interval.fromDateTimes(this.createdAt, new Date()).count('seconds');
  }
}
```

For example, running `npm run codegen` on the above ends up throwing the following error because no type is explicitly specified:

```
Error: Function isn't a valid type for accessor/function/property
```

```ts title="src/ent/user.ts"
export class User extends UserBase {

  @gqlField()
  howLong(): number {
    return Interval.fromDateTimes(this.createdAt, new Date()).count('seconds');
  }
}
```

Updating the above to indicate it's returning `number` actually still leads to an error because GraphQL differentiates between `Int` and `Float` even though TypeScript/JavaScript doesn't.

So, the way to actually get this to work is as follows:

```ts title="src/ent/user.ts"
export class User extends UserBase {
  @gqlField({
    type: GraphQLInt
  })
  howLong(): number {
    return Interval.fromDateTimes(this.createdAt, new Date()).count('seconds')
  }
}
```

which updates the GraphQL schema as follows:

```ts title="src/graphql/schema.gql"

type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  howLong: Int!
}
```

An example where no annotation is needed is:

```ts title="src/ent/user.ts"
export class User extends UserBase {

  @gqlField()
  get fullName(): string {
    return this.firstName + " " + this.lastName;
  }

  // OR 

  @gqlField()
  fullName(): string {
    return this.firstName + " " + this.lastName;
  }
}
```

which updates the GraphQL schema as follows:

```ts title="src/graphql/schema.gql"
type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  fullName: String!
}
```

Considering how annoying it is to remember, it's probably best to just always indicate the `type`.

## name

Indicates the name of the GraphQL field. Should be used when we want a different name than the name of the function, method or property.

## description

Indicates the description of the GraphQL field. Will be added to the Schema and exposed in tools like [GraphiQL](https://github.com/graphql/graphiql) or [Playground](https://github.com/graphql/graphql-playground).

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
  type?: Type | Array<Type> | GraphQLConnection<Type>; // types or lists of types or GraphQLConnectionType
}
```

Supported type formats:

### GraphQLScalarType

`GraphQLScalarType` refers to a GraphQL Scalar like `GraphQLInt`, `GraphQLFloat`, `GraphQLBoolean` like seen above in `howLong`.

### ClassType

refers to objects such as Ents which are exposed to GraphQL.

For example, this contrived example:

```ts
class User {
  @gqlField({ type: User, name: "self" })
  async loadSelf(): Promise<User> {
    return new User();
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/schema.gql"
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
  @gqlField({ type: [User], name: "selves" })
  async loadSelf(): Promise<User[]> {
    return [new User()];
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/schema.gql"
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
    type: "Contact",
    nullable: true,
    name: "contactSameDomain",
  })
  async getFirstContactSameDomain(): Promise<Contact | undefined> {
  ///...
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/schema.gql"
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
  @gqlField({ type: "[Contact]", name: "contactsSameDomain" })
  async getContactsSameDomain(): Promise<Contact[]> {
    return [];
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/schema.gql"
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


## nullable

Indicates this field is nullable.

If `true` and a list, means the list is nullable even if the contents of the list isn't:

```ts
class User {
  @gqlField({ type: "[Contact]", name: "contactsSameDomain", nullable: true })
  async getContactsSameDomain(): Promise<Contact[] | null> {
    return [];
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/schema.gql"
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
  @gqlField({ type: "[Contact]", name: "contactsSameDomain", nullable: "contents" })
  async getContactsSameDomain(): Promise<(Contact | null)[]> {
    return [];
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/schema.gql"
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
  @gqlField({ type: "[Contact]", name: "contactsSameDomain", nullable: "contents" })
  async getContactsSameDomain(): Promise<(Contact | null)[] | null> {
    return [];
  }
}
```

updates the GraphQL schema as follows:

```graphql title="src/graphql/schema.gql"
type User implements Node {
  id: ID!
  firstName: String!
  lastName: String!
  emailAddress: String!
  contactsSameDomain: [Contact]
}
```

[Check out](https://graphql.org/learn/schema/#lists-and-non-null) for more about lists and null in GraphQL.
