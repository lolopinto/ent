---
sidebar_position: 3
---

# Custom Queries

As a product gets more complicated, adding custom [queries](https://graphql.org/learn/schema/#the-query-and-mutation-types) to the schema becomes essential. This shows how to do so.

## Viewer

The [Viewer](/docs/core-concepts/viewer), which was introduced earlier is never automatically exposed in the GraphQL schema because there's no uniformity in what can be exposed across different products. So if/when this needs to be exposed, it has to be done manually.

Here's an example which exposes `Viewer`:

```ts title="src/graphql/resolvers/viewer.ts"
@gqlObjectType({ name: "Viewer" })
export class ViewerType {
  constructor(private viewer: Viewer) {}

  @gqlField({ type: GraphQLID, nullable: true })
  async viewerID() {
    const user = await this.user();
    if (!user) {
      return null;
    }
    return encodeGQLID(user);
  }

  @gqlField({ type: User, nullable: true })
  async user(): Promise<User | null> {
    const v = this.viewer.viewerID;
    if (!v) {
      return null;
    }
    return User.loadX(this.viewer, v);
  }
}

export default class ViewerResolver {
  @gqlQuery({ name: "viewer", type: ViewerType })
  viewer(@gqlContextType() context: RequestContext): ViewerType {
    return new ViewerType(context.getViewer());
  }
}
```

This updates the GraphQL schema as follows:

```graphql title="src/graphql/schema.gql"
type Viewer {
  viewerID: ID
  user: User
}
```

Here's what's happening here:

* This adds a new [object](https://graphql.org/learn/schema/#object-types-and-fields) `Viewer` to the GraphQLSchema represented by the class `ViewerType`.
* `Viewer` object has 2 fields:
  * nullable `viewerID` of type `ID`
  * nullable `user` of type `User`
* New field `viewer` added to `Query` Type.

This uses the following concepts to implement this:

* [gqlQuery](#gqlquery)
* [gqlField](/docs/custom-graphql/gql-field)
* [gqlObjectType](#gqlobjecttype)
* [gqlContextType](/docs/custom-graphql/gql-context)

## gqlQuery

This adds a new field to the GraphQL `Query` type. See example usage [above](#viewer).

Accepts the following options which overlap with gqlField:

* `name` for the name of the GraphQL field 
* `description` of the field
* `type`: type returned by the field

## gqlObjectType

Adds a new object to the schema. See example usage [above](#viewer).

Options:

### name

Name of the object. If not specified, defaults to the name of the class

### description

Description of the object. Will be added to the Schema and exposed in tools like [GraphiQL](https://github.com/graphql/graphiql) or [Playground](https://github.com/graphql/graphql-playground).
