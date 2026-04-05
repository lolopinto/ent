import {
  ActionOperation,
  EntSchema,
  EnumType,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";

const NoteSchema = new EntSchema({
  fields: {
    workspaceID: UUIDType({
      immutable: true,
      fieldEdge: {
        schema: "Workspace",
        inverseEdge: "notes",
      },
      index: true,
    }),
    authorID: UUIDType({
      immutable: true,
      fieldEdge: {
        schema: "User",
        inverseEdge: "notesAuthored",
      },
      index: true,
    }),
    title: StringType(),
    body: StringType(),
    summary: StringType({ nullable: true }),
    status: EnumType({
      values: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      tsType: "NoteStatus",
      graphQLType: "NoteStatus",
      serverDefault: "DRAFT",
    }),
  },
  edges: [
    {
      name: "tags",
      schemaName: "Tag",
      inverseEdge: {
        name: "notes",
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
    {
      name: "savedBy",
      schemaName: "User",
      inverseEdge: {
        name: "savedNotes",
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
  indices: [
    {
      name: "workspace_notes_status_idx",
      columns: ["workspaceID", "status"],
    },
  ],
});

export default NoteSchema;
