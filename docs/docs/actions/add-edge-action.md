---
sidebar_position: 5
---

# Add Edge Action

This is done via the `ActionOperation.AddEdge` [operation](/docs/ent-schema/actions#operation).

Based on the [schema](/docs/actions/action#schema) with the `AddEdge` action in the edge named `hosts` leads to 2 classes.

First, the base class:

```ts title="src/ent/event/actions/generated/event_add_host_action_base.ts"
export class EventAddHostActionBase implements Action<Event> {
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

  addHost(id: ID) {
    //...
  }
  // ...
}
```

and then the subclass:

```ts title="src/ent/event/actions/event_add_host_action.ts"
import {
import { EventAddHostActionBase } from "src/ent/event/actions/generated/event_add_host_action_base";

export default class EventAddHostAction extends EventAddHostActionBase {}
```

The base class `EventAddHostActionBase` is where all shared functionality is and will be regenerated as the action configuration changes. It has the default privacy policy plus a bunch of other methods shown below.

The subclass will be generated **once** and any customizations can be applied there.

## Usage

```ts
  const [event, host] = await Promise.all([
    createEvent(),
    createUser(),
  ]);

  // adds host and returns event. throws if there was an error
  const event2 = await EventAddHostAction.create(viewer, event).addHost(host.id).saveX();

  // adds host and returns event. returns null if there was an error
  const event3 = await EventAddHostAction.create(viewer, event).addHost(host.id).save();

// validates that host can be added (e.g. viewer has the right permissions or the validator allows it) and throws if not
  const valid = await EventAddHostAction.create(viewer, event).addHost(host.id).validX();

  // validates that host can be added (e.g. viewer has the right permissions or the validator allows it) and returns true/false 
  const valid2 = await EventAddHostAction.create(viewer, event).addHost(host.id).valid();
```

## GraphQL

The following GraphQL schema is generated which uses the above API.

``` title="src/graphql/schema.gql"
type Mutation {
  eventAddHost(input: EventAddHostInput!): EventAddHostPayload!
}

type EventAddHostPayload {
  event: Event!
}

input EventAddHostInput {
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
mutation eventAddHostMutation($input: EventAddHostInput!) {
  eventAddHost(input: $input) {
    event {
      id 
      creator {
        id
      }
    }
  }
}
```
