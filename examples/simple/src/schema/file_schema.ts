import {
  ActionOperation,
  EntSchema,
  UUIDType,
  StringType,
} from "@snowtop/ent/schema/";

const FileSchema = new EntSchema({
  fields: {
    name: StringType(),
    path: StringType(), // path to the file
    creator_id: UUIDType({
      fieldEdge: {
        schema: "User",
      },
    }),
  },

  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});
export default FileSchema;
