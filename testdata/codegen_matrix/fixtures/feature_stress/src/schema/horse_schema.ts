import { ActionOperation, EntSchema, StringType } from "@snowtop/ent/schema";

const HorseSchema = new EntSchema({
  fields: {
    name: StringType(),
  },
  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});

export default HorseSchema;
