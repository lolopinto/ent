---
sidebar_position: 6
---

# Actions

Actions are the way to configure writes in the system. Instead of just a blanket create, edit and delete option, we believe it makes more sense to have more nuanced options.

You can think of an action as a singular action (pun intended!) performed by a user. For example, consider a `User` object, there's different things that can be done by the user with very different permission checks or side effects based on what fields are being changed.

In concrete terms, consider a `User` schema as follows:

```ts title="src/schema/user.ts"
export default class User extends BaseEntSchema implements Schema {
  fields: Field[] = [
    StringType({ name: "firstName" }),
    StringType({ name: "lastName" }),
    EmailType({ name: "emailAddress", unique: true }),
    PhoneNumberType({
      name: "PhoneNumber",
      unique: true,
    }),
    PasswordType({ name: "password"}),
    EnumType({ name: "accountStatus", values: ["UNVERIFIED", "VERIFIED", "DEACTIVATED", "DISABLED"], serverDefault: "UNVERIFIED" }),
    BooleanType({
      name: "emailVerified",
      hideFromGraphQL: true,
      serverDefault: "FALSE",
    }),
  ];
}
```

Here are a few of the actions that come to mind:

* create user with fields `firstName`, `lastName`, `emailAddress`, `phoneNumber`, `password` 
* edit profile fields `firstName`, `lastName`
* edit `emailAddress` which may be broken into two actions:
  * `editEmailAddress` which actually means send confirmation code to new email address to verify that user has access to email and doesn't get locked out
  * `confirmEditEmailAddress` which takes the email and code, verifies they're correct and then actually updates the email address
* edit `phoneNumber` which can be broken up into 2 same as above
* delete user
* verify email address by sending code and updating `emailVerified` state to true
* update `accountStatus` in internal tool and confirm that only users with admin privileges can do it
* update password

Having just one big edit mutation that handles all this gets complicated really quickly hence we break each of these into separate chunks that are much easier to reason about.

## Mutations

With all that said, most objects don't need this level of complexity and just need the CUD in CRUD. That can be configured as follows:

```ts title="src/schema/event.ts"
export default class Event extends BaseEntSchema implements Schema {
  fields: Field[] = [
    //...
  ];

actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
```

That adds a `eventCreate`, `eventEdit` and `eventDelete` action with all the editable fields showing up in the create and delete actions.

And over time as the product evolves, the action(s) can be configured and updated to simplify or make things more complicated.

This allows us to straddle the gap between a simple and complicated experience as needed depending on the use case.

## Options

### operation

specifies the type of action that's created. We have the following types:

* `ActionOperation.Create`: create an object. inserts a new row into the database.
* `ActionOperation.Edit`: edits an object. edits an existing row in the database.
* `ActionOperation.Delete`: deletes on object. deletes an existing row in the database.
* `ActionOperation.Mutations`: shortcut to easily get `create`, `edit`, and `delete` actions. Cannot be customized. If you want to customize the actions, have to itemize
* `ActionOperation.AddEdge`: adds a new [edge](/docs/ent-schema/edges)
* `ActionOperation.RemoveEdge`: removes an [edge](/docs/ent-schema/edges)
* `ActionOperation.EdgeGroup`: creates a new action for an [edge group](/docs/ent-schema/edge-groups)

### fields

Associated with an `edit` or `create` action, specifies the fields that should be in the action. When missing, defaults to all the editable fields in the object

### actionName

Overrides the default action name created.

* The default for `create` actions is of the format `Create{Schema}Action`
* The default for `edit` actions is of the format `Edit{Schema}Action`
* The default for `delete` actions is of the format `Delete{Schema}Action`

If more than one action of a type exists, the name must be overriden since we can't have duplicate action names. e.g. in the example given above with the `User` object

### inputName

Overrides the default [input](/docs/actions/input) name created.

* The default for `create` actions is of the format `{Schema}CreateInput`
* The default for `edit` actions is of the format `{Schema}EditInput`

If more than one action of a type exists, the name must be overriden since we can't have duplicate input names. e.g. in the example given above with the `User` object

### graphQLName

Overrides the default GraphQL mutation name created.

* The default for `create` actions is of the format `{lowerCaseSchema}Create`.
* The default for `edit` actions is of the format `{lowerCaseSchema}Edit`.
* The default for `delete` actions is of the format `{lowerCaseSchema}Delete`.

If more than one action of a type in a Schema exists, the name must be overriden since we can't have duplicate action names. e.g. in the example given above with the `User` object.

### hideFromGraphQL

hides the action from being exposed as a `Mutation` in GraphQL. This is used for things that shouldn't be exposed in the public API e.g. an action that's internal to the system.

### actionOnlyFields

sometimes, we need fields that are not in the schema that need to be generated in the [action input](/docs/actions/input) or in the [input to the graphql mutation](https://graphql.org/learn/schema/#input-types).

For example, a possible confirm email address action which was referenced above, can be configured as follows:

```ts title="src/schema/user.ts"
export default class User extends BaseEntSchema implements Schema {
  fields: Field[] = [
    //...
  ];

  actions: Action[] = [
    // confirm email address with code sent in last time
    {
      operation: ActionOperation.Edit,
      actionName: "ConfirmEditEmailAddressAction",
      graphQLName: "confirmEmailAddressEdit",
      inputName: "ConfirmEditEmailAddressInput",
      actionOnlyFields: [{ name: "code", type: "String" }],
      // fields are default optional in edit mutation, this says make this required in here
      fields: [requiredField("EmailAddress")],
    },
  ];
}
```

This adds an additional required field `code` of type `String` to be generated for this action.

#### options

* `name`: name of the field
* `type`: type of the field. currently restricted to scalars `ID`, `Boolean`, `Int`, `Float`, `String`, `Time`
* `list`: indicates if this is a list e.g. it transforms a `String` type from `string` to `string[]`.
* `nullable`: if true, item is nullable e.g. `string | null`. if a list, it gets slightly more complicated
  * if a list and `nullable` is `true`, the list itself is nullable but not its contents. The GraphQL type here would be `[String!]`
  * if a list and `nullable` is `contents`, the contents of the list are nullable but not the list. The GraphQL type here would be `[String!]`
  * if a list and `nullable` is `contentsAndList`, both the list and its contents are nullable. The GraphQL type here would be `[String]`
[Check out](https://graphql.org/learn/schema/#lists-and-non-null) for more about lists and null in GraphQL.
* `actionName`: allows exposing the fields of another action with the given name as a sub-input.

For example,

```ts title="src/schema/event.ts"
export default class Event extends BaseEntSchema {
  fields: Field[] = [];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      actionOnlyFields: [
        {
          name: "address",
          type: "Object",
          nullable: true,
          actionName: "CreateAddressAction",
        },
      ],
    },
  ];
}
```

results in this schema (assuming an `Address` object with the fields `street`, `city`, `state`, `zipCode`, `apartment`):

```graphql title="src/graphql/schema.gql"
input EventCreateInput {
  name: String!
  startTime: Time!
  endTime: Time
  location: String!
  description: String
  inviteAllGuests: Boolean!
  address: AddressEventCreateInput
}

input AddressEventCreateInput {
  street: String!
  city: String!
  state: String!
  zipCode: String!
  apartment: String
}
```

This allows us to create the event and its associated address in the same request using [triggers](/docs/actions/triggers).

See [Action Only Fields](/docs/actions/action-only-fields) for more.

## NoFields

Sometimes, there's scenarios where we want no fields associated with the schema to be generated in the action input and need a way to indicate this.

`NoFields` exposed by the framework enables this.

For example. an edit email address action that takes an email address and generates a unique code, stores the code somewhere e.g. redis and sends a confirmation email with the code embedded can be represented as follows:

```ts title="src/schema/user.ts"
export default class User extends BaseEntSchema {
  fields: Field[] = [];

  actions: Action[] = [
    // send confirmation code for email address
    {
      // we're not saving anything in the db so we use actionOnlyField to specify a required email address
      // send email out
      operation: ActionOperation.Edit,
      actionName: "EditEmailAddressAction",
      graphQLName: "emailAddressEdit",
      inputName: "EditEmailAddressInput",
      // still need no fields even when we want only actionOnlyFields
      fields: [NoFields],
      // we use actionOnlyField here so emailAddress is not saved

      // we use a different field name so that field is not saved
      actionOnlyFields: [{ name: "newEmail", type: "String" }],
    },
  ];
}
```

We make sure to use a different field name with the action only field such as `newEmail` so that the email address isn't saved yet.

## requiredField

makes a field *required* in an action. Needed in the following cases:

* if a field is nullable in the schema but we want it required in the action e.g. a schema with both email address and phone number, both nullable and either can be used as the auth mechanism. When we want to make sure that a confirm email address action has a required email address field, this is used.
* similar to above, we want to make a field which is nullable in the schema required in a create action.
* we want to make a field required in an edit action. By default, all fields in edit mutation are optional since they may not be all edited at the same time.

e.g.

```ts title="src/schema/user.ts"
export default class User extends BaseEntSchema {
  fields: Field[] = [];

  actions: Action[] = [
    // confirm email address with code sent in last time
    {
      operation: ActionOperation.Edit,
      actionName: "ConfirmEditEmailAddressAction",
      graphQLName: "confirmEmailAddressEdit",
      inputName: "ConfirmEditEmailAddressInput",
      actionOnlyFields: [{ name: "code", type: "String" }],
      // fields are default optional in edit mutation, this says make this required in here
      fields: [requiredField("EmailAddress")],
    },
  ];
}
```

## optionalField

Inverse of [requiredField](#requiredField) above. Want to make a field which would be required optional. Usually means that a default value is set in a [trigger](/docs/actions/triggers)
