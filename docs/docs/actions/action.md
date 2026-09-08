---
sidebar_position: 1
---

# Action

Action is the way to perform writes in the system. The [configuration](/docs/ent-schema/actions) determines what code is generated and the developer is able to further customize as needed.

There are high level 3 different modes when writing:

* creating a node
* editing the node
* deleting the node

There are however different configuration options that end up breaking down slightly differently:

* creating a node
  * [create action](/docs/actions/create-action)
* editing a node
  * [edit action](/docs/actions/edit-action)
  * [add edge action](/docs/actions/add-edge-action)
  * [remove edge action](/docs/actions/remove-edge-action)
  * [edge group action](/docs/actions/edge-group-action)
* deleting a node:
  * [delete action](/docs/actions/delete-action)

## Customizations

There are different ways to customize the action after the code has been generated:

* permissions: is the viewer allowed to perform this action
* validators: validate the input in addition to the per-field validation that may already exist
* triggers: customize the list of side effects that should be added to the transaction related to this action
* observers: customize the list of external side effects e.g. send an email, send a text, add some logging, etc.

We'll dive into each of these in the following sections.

## Transactions

If you need to coordinate multiple actions at the call site, use a [Transaction](/docs/actions/transactions) to run them together. For work that belongs to an action, use [Triggers](/docs/actions/triggers) to queue changesets whose writes share the action's transaction. Trigger callbacks run before the ordinary write transaction. To include their reads and decisions in the transaction, call the action inside [`withTransaction`](/docs/actions/transactions#transaction-scoped-reads-and-actions).

## Default Privacy Policy

The default [privacy policy](/docs/core-concepts/privacy-policy) is that any logged in user i.e. Viewer's [viewerID](/docs/core-concepts/viewer#viewerid) is not `null` can perform the action.

## Schema

We'll use the following schema as our base example and go into each of them:

```ts title="src/schema/event_schema.ts"
const EventSchema = new EntSchema({
  fields: {
    name: StringType(),
    creatorID: UUIDType({
      fieldEdge: { schema: "User", inverseEdge: "createdEvents" },
      storageKey: "user_id",
    }),
    start_time: TimestampType(),
    end_time: TimestampType({ nullable: true}),
    location: StringType({
      graphqlName: "eventLocation",
    }),
  }, 

  edges: [
    {
      name: "hosts",
      schemaName: "User",
      inverseEdge: {
        name: "userToHostedEvents",
      },
      edgeActions: [
        {
          operation: ActionOperation.AddEdge,
        },
        {
          operation: ActionOperation.RemoveEdge,
        },
      ],
    },
  ], 

  edgeGroups: [
    {
      name: "rsvps",
      groupStatusName: "rsvpStatus",
      nullStates: ["canRsvp"],
      statusEnums: ["attending", "declined", "maybe"],
      edgeAction: {
        operation: ActionOperation.EdgeGroup,
      },
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
  ], 
}); 
export default EventSchema; 
```
