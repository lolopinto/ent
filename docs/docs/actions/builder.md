---
sidebar_position: 11
---

# Builder

The Builder is the building block for Actions. Even though Action provides the ability to restrict the fields and edges that are exposed to external clients, developers should still have the full power to mutate the object as they see fit.

## Builder Interface

```ts
interface Builder<T extends Ent> {
  existingEnt?: Ent;
  ent: EntConstructor<T>;
  placeholderID: ID;
  readonly viewer: Viewer;
  build(): Promise<Changeset<T>>;
  operation: WriteOperation;
  editedEnt?(): Promise<T | null>;
}
```

## Generated Builder

For the [Schema](/docs/actions/action#schema), the generated builder looks as follows:

```ts title="src/ent/event/actions/event_builder.ts"
export interface EventInput {
  name?: string;
  creatorID?: ID | Builder<User>;
  startTime?: Date;
  endTime?: Date | null;
  location?: string;
}

export interface EventAction extends Action<Event> {
  getInput(): EventInput;
}

export class EventBuilder implements Builder<Event> {

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: EventAction,
    public readonly existingEnt?: Event | undefined,
  ) {
    //...
  }

  // override input
  updateInput(input: EventInput);

  // repeat for every edge...
  addAttending(...nodes: ID[] | User[] | Builder<User>[]): EventBuilder;
  addAttendingID(
    id: ID | Builder<User>,
    options?: AssocEdgeInputOptions,
  ): EventBuilder;
  removeAttending(...nodes: ID[] | User[]): EventBuilder;

  async build(): Promise<Changeset<Event>>;
  async valid(): Promise<boolean>;
  async validX(): Promise<void>;
  async save(): Promise<void>;
  async saveX(): Promise<void>;
}
```

Each Action has an instance of this Builder and the Builder does the heavy lifting in terms of the actual changes.

Each [Trigger](/docs/actions/triggers), [Validator](/docs/actions/validators), and [Observer](/docs/actions/observers) is passed an instance of the Builder.

The Builder can be used to update the value of fields in a trigger, [add](/docs/actions/triggers#update-builder) or remove edges or passed in as [input](/docs/actions/triggers#input) to other fields.
