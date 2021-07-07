---
sidebar_position: 4
---

# Edges

Edges provide the ability to express connections between nodes in the graph. They allow a standardized way to indicate a relationship.

They're often used when there's a many-to-many relationship between two entities. For example, the following are perfect use cases:

* friends in a social network
* attendees of an event
* members of a group
* followers of a profile in a social network
* photos of an album

They can also be used for 1-many or 1-1 relationships as needed.

The advantages of edges is they're standardized in the framework and make it easy to iterate quickly.

## Types of edges

There are three types of edges supported.

### one-way edge

This is the default. This can be used for 1-many edges.

For example, given an events based system, the creator can be stored in the `events` table and the list of created events for a user can be represented with an edge. This can also be represented with an [indexed foreign key](/docs/ent-schema/fields#foreignkey) on the `events` table but if you'd rather not have foreign keys, here's an easy alternative.

```ts  title="src/schema/event.ts"
export default class Event extends BaseEntSchema implements Schema {
  fields: Field[] = [
    //...
    UUIDType({
      name: "creatorID",
      fieldEdge: { schema: "User", inverseEdge: "createdEvents" },
      storageKey: "user_id",
    }),
  ];
```

```ts title="src/schema/user.ts"
export default class User extends BaseEntSchema implements Schema {
  fields: Field[] = [
    // ...
  ];

  edges: Edge[] = [
    {
      name: "createdEvents",
      schemaName: "Event",
    },
  ];
```

### symmetric edge

This represents an edge that has the same relationship on both sides. For example, friends in a social network system. 

```ts title="src/schema/user.ts"
export default class User extends BaseEntSchema implements Schema {
  fields: Field[] = [
    //...
  ];

  edges: Edge[] = [
    {
      name: "friends",
      schemaName: "User",
      symmetric: true,
    },
  ];
}
```

Anytime an edge is written from `id1` to `id2`, the system automatically writes the inverse edge from `id2` to `id1` with the same `time` and `data` fields. This makes it easy to query from either side of the connection, e.g. fetching the list of friends of either user.

In the future, once we support different shards, the benefit of this design will be seen even more as each edge would/should be collocated on the same shard.

### inverse edge

This represents a many-many edge that has a different relationship on the other side. For example,

* attendees of an event
  * one-way: user -> events attending
  * other-way: event -> users attending
* members of a group
  * one-way: user -> groups user member of
  * other-way: group -> members of
* followers of a profile in a social network
  * one-way: user -> followers
  * other-way: user -> people followed by

Inverse edge should be used if you ever want the count or to list the nodes at the end of the inverse edge.

To express the hosts of an event and the inverse, events hosted by a user, the schema is expressed as follows:

```ts title="src/schema/event.ts"
export default class Event extends BaseEntSchema implements Schema {
  fields: Field[] = [
//...
  ];

  edges: Edge[] = [
    {
      name: "hosts",
      schemaName: "User",
      inverseEdge: {
        name: "userToHostedEvents",
      },
    },
  ];
```

Anytime an edge is written from `id1` to `id2`, the system automatically writes the inverse edge from `id2` to `id1` with the same `time` and `data` fields. This makes it easy to query from either side of the connection.

In the future, once we support different shards, the benefit of this design will be seen even more as each edge would/should be collocated on the same shard.

## Database

A standard edge table has the following columns:

import DatabaseTabs from "../../src/components/DatabaseTabs";
import PostgresEventRsvpsSrc from "./postgres_event_rsvps.txt";
import SqliteEventRsvpsSrc from "./sqlite_event_rsvps.txt";

<DatabaseTabs postgres={PostgresEventRsvpsSrc} sqlite={SqliteEventRsvpsSrc} />

* `id1` represents the source of the edge
* `id1_type` is the *type* of `id1`
* `edge_type` is a unique identifier that represents the edge that's created by the framework
* `id2` represents the destination of the edge
* `id2_type` represents the *type* of `id2`
* `time` represents the time the edge was created. However, it can be used to represent any sortKey since edges are sorted by `time` in descending order. So, it can be overriden to represent the native order of a collection for example
* `data` is just for any extra data that should be associated with this edge. It defaults to `NULL`

### indices

There's a primary key on three fields: `id1`, `edge_type`, and `id2` because each edge is unique on those three fields.

The `time` field is indexed to optimize querying since edges are by default sorted by time in descending order.

We currently don't support adding custom indices or customizing the table at the moment but could in the future.

## Options

### name

name of the edge. Edge names should be unique in each schema.

### schemaName

name of the schema at the end of the edge e.g. `User`, `Event`.

### symmetric

boolean indicating [symmetric](/docs/ent-schema/edges#symmetric-edge) edge.

### unique

boolean indicating edge is unique.
[Current limitation](https://github.com/lolopinto/ent/issues/38) is that it doesn't work when edges are shared across the same table.

In a contact management system, to represent an edge from the `User` to their own `Contact`

```ts title="src/schema/user.ts"
export default class User extends BaseEntSchema implements Schema {
  fields: Field[] = [];

  edges: Edge[] = [
    {
      name: "selfContact",
      unique: true,
      schemaName: "Contact",
    },
  ];
}
```

results in a unique constraint added to the db

import PostgresUserSelfContactEdges from "./postgres_user_self_contact_edges.txt";
import SqliteUserSelfContactEdges from "./sqlite_user_self_contact_edges.txt";

<DatabaseTabs postgres={PostgresUserSelfContactEdges} sqlite={SqliteUserSelfContactEdges} />

### inverseEdge

allows configuring the [inverse edge](/docs/ent-schema/edges#inverse-edge).

### tableName

allows one to override the name of the table generated for this edge.

### hideFromGraphQL

hides the edge from being exposed as a `Connection` in GraphQL. This is used for things that shouldn't be exposed in the public API e.g. data that's internal to the system.

### edgeActions

allows configuring the [actions](/docs/actions/action) generated for this edge. Two actions are currently supported:

* [add edge](/docs/actions/add-edge-action)
* [remove edge](/docs/actions/remove-edge-action)

## assoc-edge-config table

Each created edge is stored in the `assoc_edge_config` table. This is the source of truth for the edge and ensures a consistent data source for edge data.

Here's what the table looks like:

import PostgresAssocEdgeConfig from "./postgres_assoc_edge_config.txt";
import SqliteAssocEdgeConfig from "./sqlite_assoc_edge_config.txt";

<DatabaseTabs postgres={PostgresAssocEdgeConfig} sqlite={SqliteAssocEdgeConfig} />