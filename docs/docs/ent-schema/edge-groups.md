---
sidebar_position: 5
---

# Edge Groups

Edge Groups provide the ability to group a related collection of [edges](/docs/ent-schema/edges) together.

This is helpful for a few reasons:

* makes state management easier. Can ensure that there's only one connection at a time.
* makes retrieving current status easier.
* allows grouping edges in the same table if you want.

For example, in an events management system

```ts title="src/schema/event.ts"
export default class Event extends BaseEntSchema implements Schema {
  edgeGroups: AssocEdgeGroup[] = [
    {
      name: "rsvps",
      groupStatusName: "rsvpStatus",
      nullStates: ["canRsvp", "cannotRsvp"],
      nullStateFn: "rsvpStatus",
      assocEdges: [
        {
          name: "invited",
          schemaName: "User",
          inverseEdge: {
            name: "invitedEvents",
          },
        },
        {
          // yes
          name: "attending",
          schemaName: "User",
          inverseEdge: {
            name: "eventsAttending",
          },
        },
        {
          // no
          name: "declined",
          schemaName: "User",
          inverseEdge: {
            name: "declinedEvents",
          },
        },
        {
          // maybe
          name: "maybe",
          schemaName: "User",
          inverseEdge: {
            name: "maybeEvents",
          },
        },
      ],
    },
  ];
}
```

we have a group named *rsvps* with 4 connected edges:

* invited
* attending
* declined
* maybe

consider the lifecycle of a user `Alice`,

* Alice is invited to an event and and edge is written from event to alice (and the inverse edge)
* Alice sees the invite and isn't sure if she can makes it so initially marks herself as *maybe*, that writes the edge from Alice to the event and then removes the previously written `invited` edge
* Closer to the event, her schedule becomes clearer and she can now rsvp as attending or declined and the correct edge (*attending* or *declined*) is written and the previous *maybe* edge is removed.

In each stage, the product developer only has to bother with writing one edge and the other edges are automatically removed by the framework if it exists.

To retrieve the current *status* of Alice's rsvp, a nice helper is provided to query this. Here's what the GraphQL representation looks like based on the schema above:

```graphql
enum EventRsvpStatus {
  INVITED
  ATTENDING
  DECLINED
  MAYBE
  CAN_RSVP
}

type Event {
  attending(first: Int, after: String, last: Int, before: String): EventToAttendingConnection!
  declined(first: Int, after: String, last: Int, before: String): EventToDeclinedConnection!
  invited(first: Int, after: String, last: Int, before: String): EventToInvitedConnection!
  maybe(first: Int, after: String, last: Int, before: String): EventToMaybeConnection!
  viewerRsvpStatus: EventRsvpStatus
}
```

To check Alice's current rsvp status, we just need to query `viewerRsvpStatus` and that'll return one of the states returned by the generated enum.

This pattern is seen in other places such as:

* group membership
  * user is invited to join a group
  * or user requests to join a group
  * user becomes a member of group by accepting invite or admin approving request to join and so either of previous edges should be removed
* friend requests
  * user A sends friend request to user B
  * user B receives a friends request from user A
  * users are now friends so friend request state should be cleaned up.

## Action

Edge Groups supports 1 [action](/docs/ent-schema/actions). It's configured as follows:

```ts
export default class Event extends BaseEntSchema implements Schema {
  edgeGroups: AssocEdgeGroup[] = [
    {
      ...
      edgeAction: {
        operation: ActionOperation.EdgeGroup,
      },
    },
  ];
}
```

This generates the action that's used to configure everything above.

### options

* `operation`: only `ActionOperation.EdgeGroup` allowed
* `actionName`: override name of action generated
* `hideFromGraphQL`: hide action generated from GraphQL
* `graphQLName`: override name of GraphQL mutation generated
* `actionOnlyFields`: specify custom fields that are generated on this action (and in GraphQL) that don't map to something in the schema or db. More on [action only fields](/docs/actions/action-only-fields).

## Options

### name

name of the edgeGroup

### groupStatusName

name of the *status* field. used to generate the enum amongst other things. In the example above, we get an enum `EventRsvpStatus` from `Event` schema and groupStatusName `rsvpStatus`

```ts
export enum EventRsvpStatus {
  Invited = "invited",
  Attending = "attending",
  Declined = "declined",
  Maybe = "maybe",
  CanRsvp = "canRsvp",
}
```

### assocEdges

list of edges in this group

### tableName

allows one to override the name of the table generated for this edge group.

### statusEnums

allows restricting the enums that should be represented in the status or grouped together for setting and unsetting.

By default, all edges in the group are part of the status but if we have edges that are just in the group for colocation purposes (either because they logically belong together or easier to reason about together) and one or more doesn't make sense for this behavior, we can limit to the ones that do.

There's also a requirement that all edges in the status have the same schema type so if there's an edge that's colocated to a different type, it should be restricted from the status here.

### nullStates

provides the ability to add one or more states to the generated enum if no edge exists.

### nullStateFn

When one or more [nullStates](#nullStates) exist, we need a way to disambiguiate which is used for the *status* depending on the viewer. This generates a protected async function in the base class that can be overriden by the developer.

For example, in the example above, this is generated

```ts title="src/ent/generated/event_base.ts"

class EventBase {
  // this should be overwritten by subclasses as needed.
  protected async rsvpStatus() {
    return EventActivityRsvpStatus.CanRsvp;
  }
}
```

and can be overriden as follows:

```ts title="src/ent/event.ts"
class Event extends EventBase {
  protected async rsvpStatus() {
    if (!this.viewer.viewerID) {
      return EventActivityRsvpStatus.CannotRsvp;
    }
    return EventActivityRsvpStatus.CanRsvp;
  }
}
```

This could be made as complicated as needed e.g. in a social networking system where a user has controls over who can send them a friend request, this function can be used to perform the permissiosn check and then return `UserFriendshipStatus.CanFriend` or `UserFriendshipStatus.CannotFriend` depending on the result of that check.

### edgeAction

See [action](#action) above.
