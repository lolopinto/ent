---
sidebar_position: 9
---

# Triggers

Triggers allows for coordinating other changes that should be made at the same time within *the same transaction*. No actual write should be made within the trigger. Changes should be queued up as needed within the trigger.

The beauty of Triggers is that there's **one** place that needs to be changed and the action can be confidently called from anywhere and we know that everything that should happen will be executed.

Any errors in Triggers fails the entire transaction.

## Trigger Interface

```ts
export interface Changeset<T extends Ent> {
  // bunch of things that aren't currently relevant
}

export interface Action<T extends Ent> {
  // bunch of other things that aren't relevant.
  changeset(): Promise<Changeset<T>>;
}

export type TriggerReturn =
  | void
  | Promise<Changeset<Ent> | void | Changeset<Ent>[] | Changeset<Ent>>
  | Promise<Changeset<Ent>>[];

export interface Trigger<T extends Ent> {
  changeset(builder: Builder<T>, input: Data): TriggerReturn;
}
```

Each Trigger takes the [Builder](/docs/actions/builder) and the [Input](/docs/actions/input).

A Trigger can update the Builder of the ent that's being edited or it can return the [Changeset](#changeset) of another Action.

## Update Builder

For example, in the example schema, to add the creator as a host of the event when it's being created:

```ts title="src/ent/events/action/create_event_action.ts"
export default class CreateEventAction extends CreateEventActionBase {
  triggers: Trigger<Event>[] = [
    {
      changeset(builder: EventBuilder, input: EventCreateInput) {
        builder.addHostID(input.creatorID);
      },
    },
  ];
}
```

## Changeset

The full power of Triggers is seen when there are dependent objects that need to be created or modified.

Assume there's an `Address` associated with the `Event` with multiple objects possibly having an Address so we have a separate object for it.

```ts title="src/schema/address.ts"
export default class Address extends BaseEntSchema implements Schema {
  fields: Field[] = [
    StringType({ name: "Street" }),
    StringType({ name: "City" }),
    StringType({ name: "State" }),
    StringType({ name: "ZipCode" }),
    StringType({ name: "Apartment", nullable: true }),
    UUIDType({
      name: "OwnerID",
      index: true, 
      polymorphic: {
        types: [NodeType.Event],
      }
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
    },
  ];
}
```

and the Event schema modified as follows:

```ts title="src/schema/event.ts"
export default class Event extends BaseEntSchema implements Schema {

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

and `CreateEventAction` modified as follows:

```ts title="src/ent/events/action/create_event_action.ts"
export default class CreateEventAction extends CreateEventActionBase {
  triggers: Trigger<Event>[] = [
    {
      changeset(builder: EventBuilder, input: EventCreateInput) {
        if (!this.input.address) {
          return;
        }
        return await CreateAddressAction.create(builder.viewer, {
          ...this.input.address,
          ownerID: builder,
          ownerType: NodeType.Event,
        }).changeset();      },
    },
  ];
}
```

Now anytime an Event is created, if the address is passed, the address info is passed to `CreateAddressAction` and a `Changeset` is generated which ensures that all details associated with the address creation are handled as part of the Event creation.

### input

Note that we pass a `Builder` to the `ownerID` field. This will get the correct `id` that was generated either in code or by the database so that the right information is stored in the `owner_id` column in the database. That also lets the framework know there's a dependency between the operations and it'll first write a row to the `events` table before writing to the `addresses` table.
