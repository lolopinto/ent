---
sidebar_position: 2
---

# Fields

A field represents each unique item that's part of the object. Each implementation of field configures its representation in the database, TypeScript generated code, and in GraphQL.

The framework comes with the following built-in fields:

* `UUIDField` for `uuid` types
* `IntegerField` for `int` types
* `FloatField` for `float` types
* `BooleanField` for `bool` types
* `StringField` for `string` types
* `TimestampField` for storing timestamps with and without timezone via the accessors `TimestampType` and `TimestamptzType`
* `TimeField` for storing time with and without timezone via the accessors `TimeType` and `TimetzType`
* `DateField` for storing dates
* `EnumField` for storing an enum e.g. restricting the value to a preconfigured list of strings

Each implementation has the ability to validate and format data in a consistent format so that the code to handle common transformations or higher level types is written only once.

This is manifested in the following types which exist in other packages that ship with the framework

* `EmailType` for validating and formatting emails. It uses the [email-addresses npm package](https://www.npmjs.com/package/email-addresses) and always stores the email in lower case regardless of the case inputted by the user
* `PhoneNumberType` which uses the [libphonenumber-js package](https://www.npmjs.com/package/libphonenumber-js) to validate the phone number and stores it in a consistent format.
* `PasswordType` which hashes and salts passwords by default using [bcrypt](https://www.npmjs.com/package/bcryptjs) before storing in the database.

It's easy to write your own custom types that can be written once and shared across different schemas and/or projects.

It's possible to configure fields based on the options provided. For example, a password field with a minimum length:

```ts
  PasswordType({ name: "password" }).minLen(10);
```

or a username field configured as follows:

```ts
  StringType({ name: "Username", minLen:3, maxLen:20 }).toLowerCase().trim(),
```

Because we want to support chaining and make the API intuitive, there tends to be an associated`FooType` factory that goes with the `FooField` to make things like above readable and easy to use.

## Options

### name

Name of the field. Each name should be unique in the schema.

### nullable

If field is nullable. If so, a `NULL` modifier is added to the database column. The `GraphQL` field generated is also nullable and the generated `TypeScript` type is nullable e.g. `string | null`.

### storageKey

If provided, used as the name of the database column. Otherwise, a snake_case version of the name is used. e.g. `first_name` for `FirstName` or `firstName` or `firstname`.

Can also be used to rename a field and not affect the database e.g. from `StringType({name:"userID"})` to `StringType({name:"accountID", storageKey:"user_id"})` changes the field to `accountID` in the Ent but keeps the column as `user_id`.

### serverDefault

default value stored on the database server. e.g. `BooleanType({ name: "NeedsHelp", serverDefault: "FALSE" })`

or `TimetzType({name: "createdTime", serverDefault: "NOW()"})`

### unique

The database column is unique across the table. adds a unique index to the database

### hideFromGraphQL

field is not exposed to GraphQL

### private

This field shouldn't be exposed in the public API of the ent. As an implementation detail, it's protected in the generated base class so that any subclasses can assess it.

### sensitive

This field shouldn't be logged if we're logging fields e.g. password fields, social security or any other sensitive data where we don't want the value to show up in the logs.

### graphqlName

If provided, used as the name of the field in GraphQL. Otherwise, a lowerPascalCase version of the name is used. e.g. `firstName` for `FirstName` or `firstName` or `firstname`.

### index

Adds an index on this column to the database.

### foreignKey

Adds a foreign key to another column in another table.

```ts
UUIDType({ name: "CreatorID", foreignKey: { schema: "User", column: "ID" } }),
```

adds a foreignKey on the `creator_id` column on the source table that references the `id` column in the `users` table.

By default, `foreignKey` creates an index on the source table because we expect to be able to query via this foreign

### fieldEdge

Only currently works with `UUIDType`. Indicates that an accessor on the source schema should be generated pointing to the other schema.

For example, given the following schemas:

```ts title="src/schema/user.ts"
export default class User extends BaseEntSchema {
  edges: Edge[] = [
    {
      name: "createdEvents",
      schemaName: "Event",
    }
  ];
}
```

```ts title="src/schema/event.ts"
export default class Event extends BaseEntSchema implements Schema {
  fields: Field[] = [
    UUIDType({
      name: "creatorID",
      fieldEdge: { schema: "User", inverseEdge: "createdEvents" },
    }),
  ]
```

* we have a 1-many [Edge](/docs/ent-schema/edges) from `User` to `Event` for events the User has created.
* we store the creator of the `Event` in the `creatorID` field of the `Event`.

The `fieldEdge` tells us that this field references schema `User` and edge `createdEvents` in that schema. That ends up generating a `creator` accessor in the Ent and GraphQL instead of `creator_id` accessor.

```ts
const event = await event.loadCreator();
```

```graphql
type Event implements Node {
  creator: User
}
```

### primaryKey

adds this column as a primary key on the table. should be used rarely

### disableUserEditable

indicates that this can't be edited by the user. must have a `defaultValueOnCreate` field if set. If set, we don't generate a field in the action or GraphQL mutation.

### defaultValueOnCreate

method that returns a default value if none is provided when creating a new instance of the object. For example, a `Todo` in a simple todo app with a default value of false:

```ts
  BooleanType({
    name: "Completed",
    index: true,
    defaultValueOnCreate: () => {
      return false;
    },
  }),
```

The `defaultValueOnCreate` method is passed 2 arguments that can be used to compute the value:

* [Builder](/docs/actions/builder)
* [Input](/docs/actions/input)

This can be used to compute a value at runtime. For example, to default to the [Viewer](/docs/core-concepts/viewer) in the todo app above, you can do:

```ts
  UUIDType({
    name: "creatorID",
    foreignKey: { schema: "Account", column: "ID" },
    defaultValueOnCreate: (builder) => builder.viewer.viewerID,
  }),
```

This can simplify your API so that you don't have to expose the `creatorID` above in your GraphQL mutation.

PS: It's recommended to either use implicit typing here or if using explicit typing, to type with `Builder<Ent>` or `Builder<NameOfEnt>` as opposed to the generated `FooBuilder` so as to not run into issues with circular dependencies.

### defaultValueOnEdit

method that returns a default value if none is provided when editing an instance of the object.

Like `defaultValueOnCreate` above, it's passed the builder and input.

### defaultToViewerOnCreate

Boolean. Shorthand to default to the viewer when creating an object if field not provided. The following are equivalent:

```ts
  UUIDType({
    name: "creatorID",
    foreignKey: { schema: "Account", column: "ID" },
    defaultToViewerOnCreate: true,
  }),
```

```ts
  UUIDType({
    name: "creatorID",
    foreignKey: { schema: "Account", column: "ID" },
    defaultValueOnCreate: (builder) => builder.viewer.viewerID,
  }),
```

This exists because it's a common enough pattern for a field to default to the logged in Viewer.

### polymorphic

Only currently works with `UUIDType`.
Indicates that this id field can represent different types and we need to keep track of the type so that we know how to find it.

We end up generating a [derivedField](#derivedFields) to represent the `type` of the object set.

If not `true` and a list of types is instead passed, only types that matches the given types are allowed to be passed in.

### derivedFields

fields that are derived from this one. very esoteric. see [polymorphic](#polymorphic)

## Field interface

The `Field` interface is as follows:

```ts
interface Field extends FieldOptions {
  // type of field: db, typescript, graphql types encoded in here
  type: Type;

  // optional valid and format to validate and format before storing
  valid?(val: any): boolean;
  format?(val: any): any;

  // value to be logged 
  logValue(val: any): any;
}
```

### type

Determines database, TypeScript, and GraphQL types.

### valid

If implemented, validates that the data passed to the field is valid

### format

If implemented, formats the value passed to the field before storing in the database. This ensures that we have consistent and normalized formats for fields.

### logValue

Provides the value to be logged when the field is logged. For sensitive values like passwords, SSNs, it doesn't log the sensitive value.

## Postscript

PS: the `PasswordType` field is private, hidden from GraphQL and sensitive by default.
