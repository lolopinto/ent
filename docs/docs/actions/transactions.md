---
sidebar_position: 16
---

# Transactions

Use `Transaction` when you need multiple actions to succeed or fail together in a single database transaction. This is different from [Triggers](/docs/actions/triggers): triggers are action-internal and already run inside the action's transaction. If any action fails (validation, privacy, or a database constraint), the entire transaction is rolled back.

## Basic usage

This example creates two contacts for the same user in a single transaction.

```ts
import { Viewer } from "@snowtop/ent";
import { Transaction } from "@snowtop/ent/action";

const viewer: Viewer = context.viewer;
const userId = viewer.viewerID!;
const action1 = CreateContactAction.create(viewer, {
  firstName: "Jon",
  lastName: "Snow",
  userId,
});
const action2 = CreateContactAction.create(viewer, {
  firstName: "Jon",
  lastName: "Snow",
  userId,
});

const tx = new Transaction(viewer, [action1, action2]);
await tx.run();
```

## Dependencies between actions

You can reference one action's builder in another action's input to express dependencies. The executor will resolve those dependencies inside the transaction.

```ts
import { Viewer } from "@snowtop/ent";
import { Transaction } from "@snowtop/ent/action";

const viewer: Viewer = context.viewer;
const userAction = CreateUserAction.create(viewer, {
  firstName: "Arya",
  lastName: "Stark",
  emailAddress: "arya@example.com",
  phoneNumber: "555-0101",
  password: "pa$$w0rd",
});

const contactAction = CreateContactAction.create(viewer, {
  firstName: "Needle",
  lastName: "Stark",
  userId: userAction.builder,
});

const tx = new Transaction(viewer, [userAction, contactAction]);
await tx.run();

const createdUser = await userAction.editedEntX();
const createdContact = await contactAction.editedEntX();
```

## Notes

- All actions should be created with the same viewer type, and you usually pass the same viewer instance to `Transaction`.
- If any action throws, nothing is committed.
- When passing builders as input values, make sure your privacy policy allows builders (for example, `AllowIfBuilder`).
