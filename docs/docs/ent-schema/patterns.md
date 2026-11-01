---
sidebar_position: 3
---

# Patterns

Patterns are shared objects for reusable concepts across schemas.

We generate [mixins](https://www.typescriptlang.org/docs/handbook/mixins.html) for Patterns to encourage code reuse except configured not to.

We have the following patterns that come with the framework:

* `Node`: adds `id`,  `createdAt` and `updatedAt` fields to any schema.
* `Timestamps`: adds `createdAt` and `updatedAt` fields to any schema. used by `Node`

The fields on the Pattern are copied over onto the schema.

```ts title="src/schema/user_schema.ts"
import { Timestamps, StringType, EntSchema, } from "@snowtop/ent/schema"; 
import { EmailType } from "@snowtop/ent-email"; 
import { PasswordType } from "@snowtop/ent-password"; 

const UserSchema = new EntSchema({
  fields: {
    Username: StringType({ primaryKey: true, minLen: 3, maxLen: 20 }).toLowerCase().trim(),
    Name: StringType(),
    EmailAddress: EmailType(),
    Password: PasswordType(),
  }, 

  patterns: [Timestamps], 
}); 
export default UserSchema; 

```

For example, in the above schema, we reuse the `Timestamps` pattern and add a new primaryKey on the table: `username`.

```ts title="src/pattern/deleted_at.ts"
import { Pattern, TimestampType } from "@snowtop/ent/schema";

export const DeletedAt: Pattern = {
  name = 'deleted_at';

  fields = {
    deletedAt: TimestampType({ nullable: true }),
  };
};
```

Or above, we add a naive `DeletedAt` pattern which has a timestamp flag to indicate when an object was soft-deleted with no current thought as to how the soft deletion is performed.

## soft deletion

The framework does come with a pattern which does implement soft deletion minimally via implict deletion.

It uses a `deleted_at` column which is null by default.

It transforms reads to check that the `deleted_at` column isn't null.

It transforms `DELETE` statements to `UPDATE` ones which updates the `deleted_at` column to the lates time.

It also provies the ability to explicitly override this behavior so that we can actually delete or load the underlying data even if deleted.

This is available in the `@snowtop/ent-soft-delete` npm package. Code is available on Github and provides an example of what can be done with complex Patterns.

## API

Write transformations select field permissions and defaults for the resulting
operation. Returning `SQLStatementOperation.Insert` clears the current write
target and creates a new row. Supply all required input fields that do not have
creation defaults; fields from the original row are not copied. The original
row remains unchanged, and Edit/Delete hooks can still read it through
`builder.existingEnt`. Generated field accessors, `getEntID()`, and inverse edges
use the new write target instead. This also applies when a transform returns
Insert for a builder that already has an existing entity. Relative numeric
expressions require an update; use absolute values for an insert.

`getEntID()` initializes the transformation and defaults even when called before
validation. Hooks can use it to obtain the eventual row ID. Within
`transformWrite`, use `builder.existingEnt.id` to read the original ID instead;
the final write target is not known until the transformation returns. Edit
defaults can read an existing target's ID. A creation default cannot await its
own new write ID; this circular read fails with an error instead of hanging.

After upgrading, regenerate builders with `tsent codegen --write-all` before
using Edit/Delete-to-Insert transformations. Previously generated accessors read
`builder.existingEnt` directly and can return the original row's values or ID.
Custom builder accessors that need the current write target should use
`builder.orchestrator.getExistingEntForWrite()`; it returns `null` for an insert.

The API for Pattern looks like:

```ts
interface UpdateOperation<T extends Ent> {
    op: SQLStatementOperation;
    existingEnt: T | null;
    viewer: Viewer;
    data?: Map<string, any>;
}

interface TransformedUpdateOperation<T extends Ent> {
    op: SQLStatementOperation;
    data?: Data;
    existingEnt?: T | null;
}

export interface Pattern {
    name: string;
    fields: FieldMap | Field[];
    disableMixin?: boolean;
    edges?: Edge[];
    transformRead?: () => Clause;
    transformWrite?: <T extends Ent>(stmt: UpdateOperation<T>) => TransformedUpdateOperation<T> | null;
    transformsDelete?: boolean;
    transformsInsert?: boolean;
    transformsUpdate?: boolean;
}
```
