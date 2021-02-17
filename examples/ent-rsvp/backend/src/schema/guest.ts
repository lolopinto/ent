import {
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
  Action,
  Constraint,
  ConstraintType,
} from "@lolopinto/ent";
import { EmailType } from "@lolopinto/ent-email";

export default class Guest extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    EmailType({ name: "EmailAddress" }),
    UUIDType({
      name: "eventID",
      foreignKey: { schema: "Event", column: "ID" },
    }),
    UUIDType({
      name: "guestGroupID",
      foreignKey: { schema: "GuestGroup", column: "ID" },
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
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
