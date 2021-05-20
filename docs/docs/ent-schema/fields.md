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

Can also be used to rename a field and not affect the database e.g. from 
`StringType({name:"userID"})` to `StringType({name:"accountID", storageKey:"user_id"})` changes the field to `accountID` in the Ent but keeps the column as `user_id`.


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
Only currently works with `UUIDType`.
TODO explain this...


### primaryKey
adds this column as a primary key on the table. should be used rarely


### disableUserEditable
indicates that this can't be edited by the user. must have a `defaultValueOnCreate` field if set. If set, we don't generate a field in the action or graphql mutation.


### defaultValueOnCreate
method that returns a default value if none is provided when creating a new instance of the object. 


### defaultValueOnEdit
method that returns a default value if none is provided when editing an instance of the object. 


### polymorphic
Only currently works with `UUIDType`.
Indicates that this id field can represent different types and we need to keep track of the type so that we know how to find it.

We end up generating a [derivedField](#derivedFields) to represent the `type` of the object set.

If not `true` and a list of types is instead passed, only types that matches the given types are allowed to be passed in.


### derivedFields
fields that are derived from this one. very esoteric. see [polymorphic](#polymorphic)


## Postscript
PS: the `PasswordType` field is private, hidden from GraphQL and sensitive by default.