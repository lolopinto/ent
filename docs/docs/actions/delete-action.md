---
sidebar_position: 4
---

# Delete Action

This is done via the `ActionOperation.Delete` or `ActionOperation.Mutations` [operation](/docs/ent-schema/actions#operation).

Based on the [schema](/docs/actions/action#schema) with the following extra configuration:

```ts title="src/event/schema.ts"
export default class Event extends BaseEntSchema implements Schema {

  actions: Action[] = [
    {
      operation: ActionOperation.Delete,
    },
  ];
}
```

leads to 2 classes.

First, the base class:

```ts title="src/ent/event/actions/generated/delete_event_action_base.ts"
export class DeleteEventActionBase implements Action<Event> {
  public readonly builder: EventBuilder;
  public readonly viewer: Viewer;

  constructor(viewer: Viewer, event: Event) {
    this.viewer = viewer;
    this.builder = new EventBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      event,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }
  // ...
}
```

and then the subclass:

```ts title="src/ent/event/actions/delete_event_action.ts"
import {
import { DeleteEventActionBase } from "src/ent/event/actions/generated/delete_event_action_base";

export default class DeleteEventAction extends DeleteEventActionBase {}
```

The base class `DeleteEventActionBase` is where all shared functionality is and will be regenerated as the action configuration changes. It has the default privacy policy plus a bunch of other methods shown below.

The subclass will be generated **once** and any customizations can be applied there.

## Usage

```ts
  const event = await createEvent();

  // deletes event and throws if it couldn't delete
  await DeleteEventAction.create(viewer, event).saveX();

  // deletes event and fails silently if it couldn't delete
  await DeleteEventAction.create(viewer, event).save();
```

## GraphQL

The following GraphQL schema is generated which uses the above API.

``` title="src/graphql/schema.gql"
type Mutation {
  eventDelete(input: EventDeleteInput!): EventDeletePayload!
}

input EventDeleteInput {
  eventID: ID!
}

type EventDeletePayload {
  deletedEventID: ID
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
mutation eventDeleteMutation($input: EventDeleteInput!) {
  eventDelete(input: $input) {
    deletedEventID
  }
}
```
