---
sidebar_position: 6
---

# Remove Edge Action

This is done via the `ActionOperation.RemoveEdge` [operation](/docs/ent-schema/actions#operation).

Based on the [schema](/docs/actions/action#schema) with the `RemoveEdge` action in the edge named `hosts` leads to 2 classes.

First, the base class:

```ts title="src/ent/event/actions/generated/event_remove_host_action_base.ts"
export class EventRemoveHostActionBase implements Action<Event> {
  public readonly builder: EventBuilder;
  public readonly viewer: Viewer;

  constructor(viewer: Viewer, event: Event) {
    this.viewer = viewer;
    this.builder = new EventBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      event,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  removeHost(id: ID) {
    //...
  }
  // ...
}
```

and then the subclass:

```ts title="src/ent/event/actions/event_remove_host_action.ts"
import {
import { EventRemoveHostActionBase } from "src/ent/event/actions/generated/event_remove_host_action_base";

export default class EventRemoveHostAction extends EventRemoveHostActionBase {}
```

The base class `EventRemoveHostActionBase` is where all shared functionality is and will be regenerated as the action configuration changes. It has the default privacy policy plus a bunch of other methods shown below.

The subclass will be generated **once** and any customizations can be applied there.

## Usage

```ts
  const event = await queryEvent();
  const hosts = await event.queryHosts().first(1).queryEnts();
  if (hosts.length !== 1) {
    throw new Error('no hosts');
  }
  const host = hosts[0];

  // remove host and returns event. throws if there was an error
  const event2 = await EventRemoveHostAction.create(viewer, event).removeHost(host.id).saveX();

  // removes host and returns event. returns null if there was an error
  const event3 = await EventRemoveHostAction.create(viewer, event).removeHost(host.id).save();

  // validates that host can be removed (e.g. viewer has the right permissions or the validator allows it) and throws if not
  const valid = await EventRemoveHostAction.create(viewer, event).removeHost(host.id).validX();

  // validates that host can be removed (e.g. viewer has the right permissions or the validator allows it) and returns true/false 
  const valid2 = await EventRemoveHostAction.create(viewer, event).removeHost(host.id).valid();
```

## GraphQL

The following GraphQL schema is generated which uses the above API.

``` title="src/graphql/schema.gql"
type Mutation {
  eventRemoveHost(input: EventRemoveHostInput!): EventRemoveHostPayload!
}

type EventRemoveHostPayload {
  event: Event!
}

input EventRemoveHostInput {
  eventID: ID!
  hostID: ID!
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
mutation eventRemoveHostMutation($input: EventRemoveHostInput!) {
  eventRemoveHost(input: $input) {
    event {
      id 
      creator {
        id
      }
    }
  }
}
```
