---
sidebar_position: 12
---

# Input

Most Actions have an Input associated with them. This is generated based on how the [action](/docs/ent-schema/actions#fields) is [configured](/docs/ent-schema/actions#actiononlyfields).

## Action Input

The Input is usually a subset of all the fields exposed in the schema for the Ent although it can include other fields if there are [action only fields](/docs/actions/action-only-fields).

For example, in the [create action](/docs/actions/create-action), the input looks as follows:

```ts title="src/ent/event/actions/generated/create_event_action_base.ts"

export interface EventCreateInput {
  name: string;
  creatorID: ID | Builder<User>;
  startTime: Date;
  endTime?: Date | null;
  location: string;
}
```

but in the [edit action](/docs/actions/edit-action), it looks slightly different with each field optional:

```ts title="src/ent/event/actions/generated/edit_event_action_base.ts"
export interface EventEditInput {
  name?: string;
  creatorID?: ID | Builder<User>;
  startTime?: Date;
  endTime?: Date | null;
  location?: string;
}
```

This input is passed as the second argument to [Triggers](/docs/actions/triggers), [Validators](/docs/actions/validators), and [Observers](/docs/actions/observers). This enables them to be strongly typed when needed e.g. in the [observer example](/docs/actions/observers#example).

## Builder Input

Each [generated Builder](/docs/actions/builder#generated-builder) has an associated Input  which the Action Input is a subset of.

The Builder Input is the source of truth and any updates (in Triggers) is done via the `updateInput` method.

For example, in a confirm email action, can update the `emailVerified` field as follows:

```ts title="src/ent/user/actions/confirm_email_action.ts"

export default ConfirmEmailAction extends ConfirmEmailActionBase {

  triggers: Trigger<User>[] = [
    {
      changeset(builder: UserBuilder, input: ConfirmEmailInput) {
        builder.updateInput({
          emailVerified:true,
        });
      },
    },
  ];
}
```
