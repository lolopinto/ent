import {
  ActionOperation,
  EntSchema,
  ConstraintType,
  StringType,
  UUIDType,
} from "@snowtop/ent";
import { EmailType } from "@snowtop/ent-email";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";

const AuthCodeSchema = new EntSchema({
  fields: {
    code: StringType(),
    userID: UUIDType({ foreignKey: { schema: "User", column: "ID" } }),
    emailAddress: EmailType({ nullable: true }),
    phoneNumber: PhoneNumberType({ nullable: true }),
  },

  hideFromGraphQL: true,

  actions: [
    {
      operation: ActionOperation.Create,
    },
    {
      operation: ActionOperation.Delete,
    },
  ],

  constraints: [
    {
      name: "uniqueCode",
      type: ConstraintType.Unique,
      columns: ["emailAddress", "code"],
    },
    {
      name: "uniquePhoneCode",
      type: ConstraintType.Unique,
      columns: ["phoneNumber", "code"],
    },
  ],
});
export default AuthCodeSchema;
