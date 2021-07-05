import {
  Action,
  ActionOperation,
  BaseEntSchema,
  BooleanType,
  Constraint,
  ConstraintType,
  Field,
  StringType,
  UUIDType,
} from "@snowtop/ent";
import { EmailType } from "@snowtop/ent-email";

export default class AuthCode extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "code" }),
    UUIDType({
      name: "guestID",
      foreignKey: { schema: "Guest", column: "ID" },
      unique: true,
    }),
    EmailType({ name: "emailAddress" }),
    BooleanType({ name: "sentCode", serverDefault: "FALSE" }),
  ];

  hideFromGraphQL = true;

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
    },
  ];

  constraints: Constraint[] = [
    {
      name: "uniqueCode",
      type: ConstraintType.Unique,
      columns: ["emailAddress", "code"],
    },
  ];
}
