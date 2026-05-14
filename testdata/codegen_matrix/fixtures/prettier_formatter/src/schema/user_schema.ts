import { ActionOperation, EntSchema, StringType } from "@snowtop/ent/schema";

const UserSchema = new EntSchema({
  fields: {
    name: StringType(),
  },
  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});

export default UserSchema;
