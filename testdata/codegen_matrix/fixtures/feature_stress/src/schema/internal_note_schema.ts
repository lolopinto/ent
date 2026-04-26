import { EntSchema, StringType } from "@snowtop/ent/schema";

const InternalNoteSchema = new EntSchema({
  hideFromGraphQL: true,
  fields: {
    note: StringType(),
  },
});

export default InternalNoteSchema;
