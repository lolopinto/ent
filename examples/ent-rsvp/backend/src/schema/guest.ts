import {
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
  Action,
  Constraint,
  ConstraintType,
} from "@snowtop/ent";
import { EmailType } from "@snowtop/ent-email";

export default class Guest extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "Name" }),
    UUIDType({
      name: "eventID",
      foreignKey: { schema: "Event", column: "ID" },
    }),
    EmailType({ name: "EmailAddress", nullable: true }),
    UUIDType({
      name: "guestGroupID",
      foreignKey: { schema: "GuestGroup", column: "ID" },
    }),
    StringType({ name: "title", nullable: true }),
  ];

  actions: Action[] = [
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
  ];

  constraints: Constraint[] = [
    {
      name: "uniqueEmail",
      type: ConstraintType.Unique,
      columns: ["eventID", "EmailAddress"],
    },
  ];
}
