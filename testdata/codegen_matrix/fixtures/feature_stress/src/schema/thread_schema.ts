import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema";

const ThreadSchema = new EntSchema({
  fields: {
    title: StringType(),
    entID: UUIDType({
      index: true,
      fieldEdge: {
        schema: "MatrixEnt",
        edgeConstName: "EntToThreads",
        indexEdge: {
          name: "threads_for_ent",
          orderby: [
            {
              column: "created_at",
              direction: "DESC",
              nullsPlacement: "last",
            },
          ],
        },
      },
    }),
  },
  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});

export default ThreadSchema;
