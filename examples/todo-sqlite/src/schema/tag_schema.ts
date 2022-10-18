import { UUIDListType } from "@snowtop/ent";
import {
  ActionOperation,
  ConstraintType,
  StringType,
  UUIDType,
} from "@snowtop/ent";
import { TodoBaseEntSchema } from "src/schema/patterns/base";

const TagSchema = new TodoBaseEntSchema({
  fields: {
    DisplayName: StringType(),
    canonicalName: StringType().trim().toLowerCase(),
    // tag has one own todo or something else?
    // AccountToTagsQuery needs to change
    ownerID: UUIDType({
      foreignKey: { schema: "Account", column: "ID" },
    }),
    // contrived field
    relatedTagIds: UUIDListType({
      nullable: true,
      fieldEdge: { schema: "Tag" },
    }),
  },

  constraints: [
    {
      name: "uniqueForOwner",
      type: ConstraintType.Unique,
      columns: ["canonicalName", "ownerID"],
    },
  ],

  actions: [
    {
      operation: ActionOperation.Create,
      fields: ["DisplayName", "ownerID", "relatedTagIds", "canonicalName"],
      optionalFields: ["canonicalName"],
    },
  ],
});
export default TagSchema;
