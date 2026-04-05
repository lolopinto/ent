import {
  ActionOperation,
  EntSchema,
  StringType,
} from "@snowtop/ent/schema";

const UserSchema = new EntSchema({
  fields: {
    name: StringType(),
    emailAddress: StringType({ unique: true }),
    bio: StringType({ nullable: true }),
  },
  actions: [
    {
      operation: ActionOperation.Create,
    },
    {
      operation: ActionOperation.Edit,
    },
  ],
});

export default UserSchema;
