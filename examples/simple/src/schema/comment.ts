import {
  Schema,
  Action,
  Field,
  BaseEntSchema,
  ActionOperation,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";

export default class Comment extends BaseEntSchema implements Schema {
  fields: Field[] = [
    // don't want a foreign key but want to type the User
    UUIDType({ name: "AuthorID", fieldEdge: { schema: "User" } }),
    StringType({ name: "Body" }),
    // should be postID but don't want to conflict with existing post edge
    UUIDType({ name: "ArticleID", polymorphic: true, index: true }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
    },
  ];
}
