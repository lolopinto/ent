---
sidebar_position: 9
---

# Triggers

Triggers allows for coordinating other changes that should be made at the same time within *the same transaction*. No actual write should be made within the trigger. Changes should be queued up as needed within the trigger.

The beauty of Triggers is that there's **one** place that needs to be changed and the action can be confidently called from anywhere and we know that everything that should happen will be executed.

Any errors in Triggers fails the entire transaction.

## Trigger Interface

```ts
export interface Changeset {
  //...
}

export interface Action< 
  TEnt extends Ent<TViewer>,
  TBuilder extends Builder<TEnt, TViewer, TExistingEnt>,
  TViewer extends Viewer = Viewer,
  TInput extends Data = Data,
  TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
> {
  // ...
  changeset(): Promise<Changeset>;
}

export type TriggerReturn =
  | void
  | Promise<Changeset | void | (Changeset | void)[]>
  | Promise<Changeset>[];

export interface Trigger<
  TEnt extends Ent<TViewer>,
  TBuilder extends Builder<TEnt, TViewer, TExistingEnt>,
  TViewer extends Viewer = Viewer,
  TInput extends Data = Data,
  TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
> {
  changeset(builder: TBuilder, input: TInput): TriggerReturn;

  priority?: number;
}
```

Each Trigger takes the [Builder](/docs/actions/builder) and the [Input](/docs/actions/input).

A Trigger can update the Builder of the ent that's being edited or it can return the [Changeset](#changeset) of another Action.

### changeset

The `changeset` method is where the logic 

## Update Builder

For example, in the example schema, to add the creator as a host of the event when it's being created:

```ts title="src/ent/events/action/create_event_action.ts"
export default class CreateEventAction extends CreateEventActionBase {
  getTriggers() {
    return [
      {
        changeset(builder: EventBuilder<EventCreateInput, Viewer>, input: EventCreateInput) {
          builder.addHostID(input.creatorID);
        },
      },
    ]; 

  }
}

```

## Changeset

The full power of Triggers is seen when there are dependent objects that need to be created or modified.

Assume there's an `Address` associated with the `Event` with multiple objects possibly having an Address so we have a separate object for it.

```ts title="src/schema/address_schema.ts"
const AddressSchema = new EntSchema({
  fields: {
    Street: StringType(),
    City: StringType(),
    State: StringType(),
    ZipCode: StringType(),
    Apartment: StringType({ nullable: true }),
    OwnerID: UUIDType({
      index: true, 
      polymorphic: {
        types: [NodeType.Event],
      }
    }),
  ],

  actions: [
    {
      operation: ActionOperation.Create,
    },
  ],
});
export default AddressSchema;
```

and the Event schema modified as follows:

```ts title="src/schema/event_schema.ts"
const EventSchema = new EntSchema({

  actions: [
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
  ], 
}); 
export default EventSchema; 

```

and `CreateEventAction` modified as follows:

```ts title="src/ent/events/action/create_event_action.ts"
export default class CreateEventAction extends CreateEventActionBase {
  getTriggers() {
    return [
    {
        changeset(builder: EventBuilder<EventCreateInput, Viewer>, input: EventCreateInput) {
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
}
```

Now anytime an Event is created, if the address is passed, the address info is passed to `CreateAddressAction` and a `Changeset` is generated which ensures that all details associated with the address creation are handled as part of the Event creation.

### input

Note that we pass a `Builder` to the `ownerID` field. This will get the correct `id` that was generated either in code or by the database so that the right information is stored in the `owner_id` column in the database. That also lets the framework know there's a dependency between the operations and it'll first write a row to the `events` table before writing to the `addresses` table.
