import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";

const TagSchema = new EntSchema({
  fields: {
    workspaceID: UUIDType({
      immutable: true,
      fieldEdge: {
        schema: "Workspace",
        inverseEdge: "tags",
        edgeConstName: "WorkspaceToTagsByWorkspaceID",
      },
      index: true,
    }),
    name: StringType(),
    color: StringType({ nullable: true }),
  },
  actions: [
    {
      operation: ActionOperation.Create,
    },
    {
      operation: ActionOperation.Edit,
    },
  ],
  indices: [
    {
      name: "workspace_tags_unique_name",
      unique: true,
      columns: ["workspaceID", "name"],
    },
  ],
});

export default TagSchema;
