import {
  ActionOperation,
  EntSchema,
  IntegerType,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";
import { VectorType } from "@snowtop/ent-pgvector";

const NoteChunkSchema = new EntSchema({
  fields: {
    noteID: UUIDType({
      immutable: true,
      fieldEdge: {
        schema: "Note",
        inverseEdge: "chunks",
      },
      index: true,
    }),
    workspaceID: UUIDType({
      immutable: true,
      fieldEdge: {
        schema: "Workspace",
        inverseEdge: "noteChunks",
      },
      index: true,
    }),
    ordinal: IntegerType(),
    content: StringType(),
    tokenCount: IntegerType({ nullable: true }),
    embedding: VectorType({
      dimensions: 6,
      nullable: true,
    }),
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
      name: "note_chunks_unique_ordinal",
      unique: true,
      columns: ["noteID", "ordinal"],
    },
  ],
});

export default NoteChunkSchema;
