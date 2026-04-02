import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";

const WorkspaceSchema = new EntSchema({
  fields: {
    name: StringType(),
    slug: StringType({ unique: true }),
    description: StringType({ nullable: true }),
    creatorID: UUIDType({
      immutable: true,
      index: true,
      fieldEdge: {
        schema: "User",
        inverseEdge: "createdWorkspaces",
      },
    }),
    embeddingModel: StringType({
      serverDefault: "text-embedding-3-small",
    }),
  },
  edges: [
    {
      name: "members",
      schemaName: "User",
      inverseEdge: {
        name: "workspaces",
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
  actions: [
    {
      operation: ActionOperation.Create,
    },
    {
      operation: ActionOperation.Edit,
    },
  ],
});

export default WorkspaceSchema;
