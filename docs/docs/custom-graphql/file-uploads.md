---
sidebar_position: 5
---

# File Uploads

Uploading files is a common of part of applications and we need a way to support that.

## gqlFileUpload

```ts
const gqlFileUpload: CustomType = {
  type: "GraphQLUpload",
  importPath: "graphql-upload",
  tsType: "FileUpload",
  tsImportPath: "graphql-upload",
};
```

`gqlFileUpload` uses the [graphql-upload](https://www.npmjs.com/package/graphql-upload) package to support File Uploads. It's also a good example of  [CustomType](/docs/custom-graphql/file-uploads#customtype) usage.

Here's an example usage:

```ts
export class ImportGuestResolver {
  @gqlMutation({ type: Event })
  async importGuests(
    @gqlContextType() context: RequestContext,
    @gqlArg("eventID", { type: GraphQLID }) eventID: ID,
    @gqlArg("file", { type: gqlFileUpload }) file: Promise<FileUpload>,
  ) {
  }
}
```

leads to this schema:

```graphql title="src/graphql/schema.gql"
type Mutation {
  importGuests(eventID: ID!, file: Upload!): Event!
}
```

Note this requires to developer to manually run `npm install graphql-upload` to use this.
