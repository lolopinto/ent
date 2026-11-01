---
sidebar_position: 17
---

# Write transformations

An action or [pattern](/docs/ent-schema/patterns) can implement `transformWrite`
to change the write operation or its target row. An action's implementation takes
precedence over the pattern's implementation.

Transformations run before defaults and field permissions are selected. Returning
`SQLStatementOperation.Update` with `existingEnt` targets that entity, including
when the action started as an insert or as an edit of another row. Returning
`SQLStatementOperation.Delete` is supported only for a delete action.

## Supported transformations

The starting action determines its return contract. Create and edit actions
return an entity, so transforming them into a delete is rejected before any
writes or transform-provided changesets are built. Use a delete action to delete
a row. For these unsupported transformations, `saveX()` throws and `save()`
returns `null`.

| Starting action | Return `Insert` | Return `Update` | Return `Delete` |
| --- | --- | --- | --- |
| Create | Create a new row | Update the supplied `existingEnt` (required) | Rejected |
| Edit | Create a new row | Update the current or supplied target | Rejected |
| Delete | Create a new row | Update the current or supplied target | Delete the current or supplied target |

Delete actions retain their `Promise<void>` save contract after transformation.
If a delete action transforms into an insert or update, use
`builder.editedEntX()` after saving to read the resulting entity.

## Transforming to an insert

Returning `SQLStatementOperation.Insert` clears the current write target and
creates a new row. Supply all required input fields that do not have creation
defaults; fields from the original row are not copied. This also applies when
the transform supplies an `existingEnt` along with `Insert`.

The original row is not updated or deleted. Edit/Delete hooks retain it through
`builder.existingEnt`, while generated field accessors and automatic inverse
edges use the new write target. Explicit edge removals still apply to the
original row's edges and do not suppress the new row's automatic inverse edges.
If privacy fails silently, `builder.editedEnt()` returns the original entity and
`builder.getEntID()` returns its ID. A later retry still follows the insert
transformation.

Relative numeric expressions require an update; use absolute values for an
insert.

## Referencing the resulting row

An early `getEntID()` call on an edit returns the current row's ID without
running the transformation. If the transform later inserts a row or targets a
different row, a scalar ID saved earlier still identifies the original row.

For a field that should reference the resulting row, pass the builder as the
field value. This records a dependency and lets the framework resolve the final
ID when writing the rows. See [Builder input in triggers](/docs/actions/triggers#input)
for an example, or use a [Transaction](/docs/actions/transactions) to coordinate
independent actions.

After field initialization, triggers and observers can read the transformed ID
with `getEntID()`. See [Builder IDs and write targets](/docs/actions/builder#ids-and-write-targets)
for accessor behavior.
