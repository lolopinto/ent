import { EntSchema, StringType } from "@snowtop/ent/schema";

const SheepSchema = new EntSchema({
  fields: {
    name: StringType(),
  },
});

export default SheepSchema;
