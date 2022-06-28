---
sidebar_position: 3
---

# Patterns

Patterns are shared objects for reusable concepts across schemas.

You can think of them like `mixins` or `traits` that exist in some programming languages.

Right now, the only concept that's shared is `fields`. Over time, we'll add other concepts e.g. `edges` and even some possible business logic to build on top of to make it more powerful.

We have the following patterns that come with the framework:

* `Node`: adds `id`, `createdAt` and `updatedAt` fields to any schema.
* `Timestamps`: adds `createdAt` and `updatedAt` fields to any schema. used by `Node`

The fields on the Pattern are copied over onto the schema.

```ts title="src/schema/user.ts"
import { Timestamps, Field, StringType, Schema, Pattern } from "@snowtop/ent/schema";
import { EmailType } from "@snowtop/ent-email";
import { PasswordType } from "@snowtop/ent-password";

export default class User implements Schema {
  fields: Field[] = [
    StringType({ name: "Username", primaryKey: true, minLen: 3, maxLen: 20 }).toLowerCase().trim(),
    StringType({ name: "Name" }),
    EmailType({ name: "EmailAddress" }),
    PasswordType({ name: "Password" }),
  ];

  patterns: Pattern[] = [Timestamps];
}
```

For example, in the above schema, we reuse the `Timestamps` pattern and add a new primaryKey on the table: `username`.

```ts title="src/pattern/deleted_at.ts"
import { Field, Pattern, TimestampType } from "@snowtop/ent/schema";

export const DeletedAt: Pattern = {
  fields: Field[] = [
    TimestampType({ name: "deletedAt", nullable: true }),
  ];
};
```

Or above, we add a naive `DeletedAt` pattern which has a timestamp flag to indicate when an object was soft-deleted with no current thought as to how the soft deletion is performed.
