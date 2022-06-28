---
sidebar_position: 11
---

# Builder

The Builder is the building block for Actions. Even though Action provides the ability to restrict the fields and edges that are exposed to external clients, developers should still have the full power to mutate the object as they see fit.

## Builder Interface

```ts
export interface Builder<
  TEnt extends Ent<TViewer>,
  TViewer extends Viewer = Viewer,
  TExistingEnt extends TMaybleNullableEnt<TEnt> = MaybeNull<TEnt>,
> {
  existingEnt: TExistingEnt;
  ent: EntConstructor<TEnt, TViewer>;
  placeholderID: ID;
  readonly viewer: TViewer;
  build(): Promise<Changeset>;
  operation: WriteOperation;
  editedEnt?(): Promise<TEnt | null>;
  nodeType: string;
}

```

## Generated Builder

For the [Schema](/docs/actions/action#schema), the generated builder looks as follows:

```ts title="src/ent/event/actions/event_builder.ts"
export interface EventInput {
  name?: string;
  creatorID?: ID | Builder<User, Viewer>;
  startTime?: Date;
  endTime?: Date | null;
  location?: string;
}

export class EventBuilder<
  TInput extends EventInput = EventInput,
  TExistingEnt extends TMaybleNullableEnt<Event> = Event | null,
> implements Builder<Event, ExampleViewer, TExistingEnt>
{
  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: Action<
      Event,
      Builder<Event, ExampleViewer, TExistingEnt>,
      ExampleViewer,
      TInput,
      TExistingEnt
    >,
    public readonly existingEnt: TExistingEnt,
  ) {
    //...
  }

  getInput(): TInput {
    return this.input;
  }

  // override input
  updateInput(input: EventInput);

  // repeat for every edge...
  addAttending(...nodes: (ID | User | Builder<User, any>)[]): this;
  addAttendingID(
    id: ID | Builder<User, any>,
    options?: AssocEdgeInputOptions,
  ): this;
  removeAttending(...nodes: (ID | User)[]): this;

  async build(): Promise<Changeset>;
  async valid(): Promise<boolean>;
  async validX(): Promise<void>;
  async save(): Promise<void>;
  async saveX(): Promise<void>;
}
```

Each Action has an instance of this Builder and the Builder does the heavy lifting in terms of the actual changes.

Each [Trigger](/docs/actions/triggers), [Validator](/docs/actions/validators), and [Observer](/docs/actions/observers) is passed an instance of the Builder.

The Builder can be used to update the value of fields in a trigger, [add](/docs/actions/triggers#update-builder) or remove edges or passed in as [input](/docs/actions/triggers#input) to other fields.
