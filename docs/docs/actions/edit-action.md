---
sidebar_position: 3
---

# Edit Action

This is done via the `ActionOperation.Edit` or `ActionOperation.Mutations` [operation](/docs/ent-schema/actions#operation).

Based on the [schema](/docs/actions/action#schema) with the following extra configuration:

```ts title="src/event/schema.ts"
export default class Event extends BaseEntSchema implements Schema {

  actions: Action[] = [
    {
      operation: ActionOperation.Edit,
    },
  ];
}
```

leads to 2 classes.

First, the base class:

```ts title="src/ent/event/actions/generated/edit_event_action_base.ts"

export interface EventEditInput {
  name?: string;
  creatorID?: ID | Builder<User>;
  startTime?: Date;
  endTime?: Date | null;
  location?: string;
}

export class EditEventActionBase implements Action<Event> {
  public readonly builder: EventBuilder;
  public readonly viewer: Viewer;
  protected input: EventEditInput;

  constructor(viewer: Viewer, event: Event, input: EventEditInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new EventBuilder(this.viewer, WriteOperation.Edit, this, event);
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  ///....
}
```

and then the subclass:

```ts title="src/ent/event/actions/edit_event_action.ts"
import {
  EditEventActionBase,
  EventEditInput,
} from "src/ent/event/actions/generated/edit_event_action_base";

export { EventEditInput };

export default class EditEventAction extends EditEventActionBase {
}
```

The base class `EditEventActionBase` is where all shared functionality is and will be regenerated as the action configuration changes. It has the default privacy policy plus a bunch of other methods shown below.

The subclass will be generated **once** and any customizations can be applied there.

`EventEditInput` is an interface that indicates what the input for the action is. What's in there is determined by a combination of the fields in the [schema](/docs/actions/action#schema) and the [fields](/docs/ent-schema/actions#fields) property in the action.

## Usage

```ts
  const event = await createEvent();

  const input: EventEditInput = {
    name: "funnest event",
  };

  // edits event and returns the newly edited event. throws if it can't be edited
  const event2 = await EditEventAction.create(viewer, event, input).saveX();

  // edit event and returns it. returns null if it can't be edited
  const event3 = await EditEventAction.create(viewer, event, input).save();

  // validates that the input is valid to edit said event. throws if invalid
  const valid = await EditEventAction.create(viewer, event, input).validX();

  // validates that the input is valid to edit said event. returns true or false
  const valid2 = await EditEventAction.create(viewer, event, input).valid();

```

## GraphQL

The following GraphQL schema is generated which uses the above API.

``` title="src/graphql/schema.gql"
type Mutation {
  eventEdit(input: EventEditInput!): EventEditPayload!
}

input EventEditInput {
  eventID: ID!
  name: String
  creatorID: ID
  startTime: Time
  endTime: Time
  eventLocation: String
}

type EventEditPayload {
  event: Event!
}

type Event implements Node {
  creator: User
  id: ID!
  name: String!
  startTime: Time!
  endTime: Time
  eventLocation: String!
  ///.... 
}
```

and called as follows:

```graphql
mutation eventEditMutation($input: EventEditInput!) {
  eventEdit(input: $input) {
    event {
      id
      creator {
        id
      }
      name
      startTime
      endTime
      eventLocation
    }
  }
}

```

## Input

When editing an object, every field is optional and isn't required to be passed in. Only fields passed in will be changed. To set a nullable field to `null`, explicitly set it to null either via the API in TypeScript or GraphQL.

To explicitly make a field required in an action, use [requiredField](/docs/ent-schema/actions#requiredfield) when configuring it.
