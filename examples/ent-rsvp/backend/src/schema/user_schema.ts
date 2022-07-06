import { ActionOperation, StringType, EntSchema } from "@snowtop/ent";
import { EmailType } from "@snowtop/ent-email";
import { PasswordType } from "@snowtop/ent-password";

const UserSchema = new EntSchema({
  fields: {
    FirstName: StringType(),
    LastName: StringType(),
    EmailAddress: EmailType({ unique: true }),
    Password: PasswordType(),
  },

  actions: [
    {
      operation: ActionOperation.Create,
      fields: ["FirstName", "LastName", "EmailAddress", "Password"],
    },
  ],
});
export default UserSchema;
