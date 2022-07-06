import {
  ActionOperation,
  StringType,
  UUIDType,
  ConstraintType,
  EntSchema,
} from "@snowtop/ent";
import { EmailType } from "@snowtop/ent-email";

const GuestSchema = new EntSchema({
  fields: {
    Name: StringType(),
    eventID: UUIDType({
      foreignKey: { schema: "Event", column: "ID" },
    }),
    EmailAddress: EmailType({ nullable: true }),
    guestGroupID: UUIDType({
      foreignKey: { schema: "GuestGroup", column: "ID" },
    }),
    title: StringType({ nullable: true }),
  },

  actions: [
    {
      operation: ActionOperation.Create,
    },
    {
      operation: ActionOperation.Delete,
    },
    {
      operation: ActionOperation.Edit,
      fields: ["Name", "EmailAddress"],
    },
  ],

  constraints: [
    {
      name: "uniqueEmail",
      type: ConstraintType.Unique,
      columns: ["eventID", "EmailAddress"],
    },
  ],
});
export default GuestSchema;