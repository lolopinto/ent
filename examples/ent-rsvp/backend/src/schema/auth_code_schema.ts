import {
  ActionOperation,
  BooleanType,
  ConstraintType,
  StringType,
  UUIDType,
  EntSchema,
} from "@snowtop/ent";
import { EmailType } from "@snowtop/ent-email";

const AuthCodeSchema = new EntSchema({
  fields: {
    code: StringType(),
    guestID: UUIDType({
      foreignKey: { schema: "Guest", column: "ID" },
      unique: true,
    }),
    emailAddress: EmailType(),
    sentCode: BooleanType({ serverDefault: false }),
  },

  hideFromGraphQL: true,

  actions: [
    {
      operation: ActionOperation.Create,
    },
  ],

  constraints: [
    {
      name: "uniqueCode",
      type: ConstraintType.Unique,
      columns: ["emailAddress", "code"],
    },
  ],
});
export default AuthCodeSchema;
