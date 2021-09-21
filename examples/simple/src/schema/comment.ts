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
    UUIDType({ name: "AuthorID" }),
    StringType({ name: "Body" }),
    // post should be here but we're choosing to store as an edge
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
    },
  ];
}
