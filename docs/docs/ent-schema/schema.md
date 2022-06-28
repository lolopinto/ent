---
sidebar_position: 1
---

# Schema

The `Schema` is the core building block that's used to configure each node in the product.

Each unique object in the application should be represented by a schema item.

The schema of the application should be in `src/schema` relative to the root of the application. For every schema in that directory, the following norms are expected:
* a `TypeScript` file in snake_case format e.g. `user.ts`, `event.ts`, `pickup_location.ts`
* It should have a default export which is an object (usually a class) that implements the `Schema` interface.
* By convention, what's exported is the pascalCase version of the file e.g. `User`, `Event`, and `PickupLocation` respectively for the above files.
Since it's a default export, the actual name doesn't matter but that's the current convention.


## Schema interface
The `Schema` interface referenced above:
```ts
// Schema is the base for every schema in typescript
export default interface Schema {
  // list of fields
  fields: Field[];

  // optional, can be overriden as needed
  tableName?: string;

  // reusable functionality in each schema
  patterns?: Pattern[];

  // edges in the schema
  edges?: Edge[];
  edgeGroups?: AssocEdgeGroup[];

  actions?: Action[];

  // treat the single primary key as enums
  // (it's possible to have other values too..)
  enumTable?: boolean;

  // data that should be saved in the db for this table
  dbRows?: { [key: string]: any }[];

  // constraints applied to the schema e.g.   
  constraints?: Constraint[];

  indices?: Index[];

  // hide node from graphql
  hideFromGraphQL?: boolean;
}
```

The only required field in the schema is `fields`. 

### fields
Represents the list of items that are associated with this object. This usually maps 1:1 to a column in the database and a field in the GraphQL representation of this object.

For a deep dive into fields, you can learn more [here](/docs/ent-schema/fields).

### tableName 
Name of the table that should be generated in the database. If not overriden, it defaults to the pluralized version of the file e.g. `users`, `events`, or `pickup_locations`


### patterns
Patterns are shared objects for reusable concepts across schemas.
E.g. there's a default `Node` pattern that adds `id`, `createdAt` and `updatedAt` fields to any schema.

For more on patterns, [visit](/docs/ent-schema/patterns).

### edges
Allows configuring relationships between different schemas without using database integrity

For more on edges, [visit](/docs/ent-schema/edges).

### edgeGroups
Allows configuring groups of edges together.

For more on edge groups, [visit](/docs/ent-schema/edge-groups).


### actions
Configures the types of writes that can be performed on this object. 
For a deep dive into actions, please [visit](/docs/actions/action).


### enumTable
Visit [Enums](/docs/ent-schema/enums) to learn more.


### dbRows
Visit [Enums](/docs/ent-schema/enums) to learn more.
Can also be used without enums.


### constraints
database constraints added to the table. [Visit](/docs/ent-schema/constraints) to learn more.


### indices
database indices added to the table. [Visit](/docs/ent-schema/indices) to learn more.


### hideFromGraphQL
hide this object from GraphQL. This automatically hides all related actions to it from GraphQL. It also hides all edges pointing to it since we can't return the object.


## BaseEntSchema
`BaseEntSchema` is a schema that uses a [Pattern](/docs/ent-schema/patterns) and adds 3 fields to the object:
* `id` field of type `uuid`
* `createdAt` field of type `timestamp`: `timestamp without time zone` in the database
* `updatedAt` field of type `timestamp`: `timestamp without time zone` in the database.

## BaseEntSchemaWithTZ
`BaseEntSchema` is a schema that uses a [Pattern](/docs/ent-schema/patterns) and adds 3 fields to the object:
* `id` field of type `uuid`
* `createdAt` field of type `timestamptz`: `timestamp with time zone` in the database
* `updatedAt` field of type `timestamptz`: `timestamp with time zone` in the database.

We'll go into the differences and what's happening here at some point later.