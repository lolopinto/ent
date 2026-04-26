import { ActionOperation, EntSchema, StringType } from "@snowtop/ent/schema";

const UserSchema = new EntSchema({
  tableName: "matrix_core_users",
  fields: {
    emailAddress: StringType({
      unique: true,
      storageKey: "email_address",
    }),
    displayName: StringType({
      nullable: true,
    }),
  },
  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});

export default UserSchema;
