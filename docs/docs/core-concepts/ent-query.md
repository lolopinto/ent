---
sidebar_position: 7
---

# Ent Query

Ent Query is the way to query for edge data, counts, or the ents at the end of the edge. It provides pagination and eventually ordering, filtering and custom ways to slice the data. We currently have two types of EntQueries:

## edge based

For every [edge](/docs/ent-schema/edges) configured, we generate an EntQuery for it.

For example, given the following schema:

```ts title="src/schema/user_schema.ts"
const UserSchema = new EntSchema({
  fields: {}, 

  edges: [
    {
      name: "friends",
      schemaName: "User",
      symmetric: true,
    },
  ] 
}); 
export default UserSchema; 

```

a `queryFriends` method is generated in the base class:

```ts title="src/ent/generated/user_base.ts"
class UserBase {
  queryFriends(): UserToFriendsQuery {
    return UserToFriendsQuery.query(this.viewer, this.id);
  }
}
```

and we can then query all kinds of information from the query.

```ts
  const user = await User.loadX(viewer, id);

  // load count
  const count = await user.queryFriends().queryRawCount();

  // query the first 10 edges
  const edges = await this.queryFriends().first(10).queryEdges();

  // query the first 10 nodes
  const ents = await this.queryFriends().first(10).queryEnts();
```

Since edges are sorted by [time in descending order](/docs/ent-schema/edges#database), to reverse the order, you can query as follows:

```ts
  const user = await User.loadX(viewer, id);

  // query the first 10 nodes
  const ents = await this.queryFriends().last(10).queryEnts();
```

There'll be a lot more querying options added over time.

### graphql

This EntQuery is also exposed as a GraphQL [Connection](https://graphql.org/learn/pagination/#complete-connection-model) and follows the [Relay Spec](https://relay.dev/graphql/connections.htm).

The schema above leads to the following GraphQL schema

```graphql title="src/graphql/generated/schema.gql"

interface Edge {
  node: Node!
  cursor: String!
}

interface Connection {
  edges: [Edge!]!
  nodes: [Node!]!
  pageInfo: PageInfo!
}

interface Node {
  id: ID!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String!
  endCursor: String!
}

type User implements Node {
  id
  friends(first: Int, after: String, last: Int, before: String): UserToFriendsConnection!
}

type UserToFriendsConnection implements Connection {
  edges: [UserToFriendsEdge!]!
  nodes: [User!]!
  pageInfo: PageInfo!
  rawCount: Int!
}

type UserToFriendsEdge implements Edge {
  node: User!
  cursor: String!
}

```

and to make the graphql query

```graphql
query friendsQuery($id: ID!, $cursor: String!) {
  node(id: $id) {
    id,
    friends(first: 10, after: $cursor) {
      edges {
        node {
          id
          ///....
        } 
        cursor
      }
      pageInfo {
        hasNextPage
      }
      rawCount
    }
  }
}
```

## index based query

For an [indexed foreign key](/docs/ent-schema/fields#foreignkey) or an [index](/docs/ent-schema/fields#index) e.g.

```ts title="src/schema/contact_schema.ts"
const ContactSchema = new EntSchema({
  fields: {
    userID: UUIDType({ foreignKey: { schema: "User", column: "ID" } }),
  }, 
}); 
export const ContactSchema; 

```

a `queryContacts` method is generated in the referenced class

```ts title="src/ent/generated/user_base.ts"
class UserBase {
  queryContacts(): UserToContactsQuery {
    return UserToContactsQuery.query(this.viewer, this.id);
  }
}
```

and we can then query all kinds of information from the query.

```ts
  const user = await User.loadX(viewer, id);

  // load count
  const count = await user.queryContacts().queryRawCount();

  // query the first 10 "edges". this just loads the data in the contacts table *without* performing any privacy checks
  const edges = await this.queryContacts().first(10).queryEdges();

  // query the first 10 nodes 
  const ents = await this.queryContacts().first(10).queryEnts();
```

Right now, the default sort key is the `id` column. However, this isn't a stable sort since we're not using an autoincrement id column. You should consider this unsorted, we do and "order by" so pagination at specific points in time is possible.

To change to use a different sort key e.g. an indexed `created_at` column, change the generated class as follows:

```ts title="src/ent/user/query/user_to_contacts_query.ts"
export class UserToContactsQuery extends UserToContactsQueryBase {
  constructor(viewer: Viewer, src: User | ID) {
    super(viewer, src, "created_at");
  }
}
```

### index graphql

This EntQuery is also exposed as a GraphQL [Connection](https://graphql.org/learn/pagination/#complete-connection-model) and follows the [Relay Spec](https://relay.dev/graphql/connections.htm).

The schema above leads to the following GraphQL schema

```graphql title="src/graphql/generated/schema.gql"

interface Edge {
  node: Node!
  cursor: String!
}

interface Connection {
  edges: [Edge!]!
  nodes: [Node!]!
  pageInfo: PageInfo!
}

interface Node {
  id: ID!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String!
  endCursor: String!
}

type Contact implements Node {
  id 
  //...
}

type User implements Node {
  id 
  contacts(first: Int, after: String, last: Int, before: String): UserToContactsConnection!
}

type UserToContactsConnection implements Connection {
  edges: [UserToContactsEdge!]!
  nodes: [Contact!]!
  pageInfo: PageInfo!
  rawCount: Int!
}

type UserToContactsEdge implements Edge {
  node: Contact!
  cursor: String!
}

```

and to make the graphql query

```graphql
query contactsQuery($id: ID!, $cursor: String!) {
  node(id: $id) {
    id,
    contacts(first: 10, after: $cursor) {
      edges {
        node {
          id
          ///....
        } 
        cursor
      }
      pageInfo {
        hasNextPage
      }
      rawCount
    }
  }
}
```

## generated code

There's a base class where all queries starting from a node goes. From the examples above:

```ts title="src/ent/generated/user_query_base.ts"

export class UserToFriendsQueryBase extends AssocEdgeQueryBase<User, User, AssocEdge
 // ....
}

export class UserToContactsQueryBase extends CustomEdgeQueryBase<Contact> { 
 // ...
}

```

And then we have a subclass for each query which can be customized as needed. These subclasses are written **once** and not touched again.

```ts title="src/ent/user/query/user_to_friends_query.ts"
import { UserToFriendsQueryBase } from "src/ent/internal";
import { AssocEdge } from "@snowtop/ent";

export class UserToFriendsEdge extends AssocEdge {}

export class UserToFriendsQuery extends UserToFriendsQueryBase {}
```

and 

```ts title="src/ent/user/query/user_to_contacts_query.ts"
import { UserToContactsQueryBase } from "src/ent/internal"; 
export class UserToContactsQuery extends UserToContactsQueryBase {}

```

### customize

For the [edge based query](#edge-based), the edge class can be customized to add extra logic, for example based on what's in the `data` or `time` [fields](/docs/ent-schema/edges#database).

To know how long the users have been friends:

```ts title="src/ent/user/query/user_to_friends_query.ts"
import { UserToFriendsQueryBase } from "src/ent/internal";
import { AssocEdge } from "@snowtop/ent";

export class UserToFriendsEdge extends AssocEdge {
  howLong() {
    return Interval.fromDateTimes(this.time, new Date()).count("seconds");
  }
}

export class UserToFriendsQuery extends UserToFriendsQueryBase {}
```

and to query a user's oldest friends:

```ts
  const edges = await this.queryFriends().last(10).queryEdges();
  edges.map(edge => edge.howLong());
```

## privacy

By default, there's no permissions for queries and the edge is always visible. This isn't always what we want so we provide the ability to indicate who can see the edge.

This can be done by adding a [Privacy Policy](/docs/core-concepts/privacy-policy) to the query class.

For example, to indicate that a user's bookmarks in a social app are visible just to the user:

```ts
class UserToBookmarksQuery extends UserToBookmarksQueryBase {
  getPrivacyPolicy() {
    return AllowIfViewerPrivacyPolicy;
  }
}
```

This indicates that just the user can see the edge from the user to their bookmarks. It doesn't affect the privacy of the underlying links, posts, tweets etc which have their own privacy.

## ents

Note that when querying ents at the end of a query, we do privacy aware loading and so we only return nodes at the end of the edge that are visible based on the ent's [privacy policy](/docs/core-concepts/ent#privacy-policy).

## count

The `queryRawCount` method returns a raw count that's not privacy aware.

We may add a privacy-aware count in the future or a way to replace this count with a privacy-aware count.
