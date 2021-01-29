import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Constraint,
  ConstraintType,
  Field,
  StringType,
  UUIDType,
} from "@lolopinto/ent";
import { EmailType } from "@lolopinto/ent-email";

export default class AuthCode extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "code" }),
    UUIDType({ name: "guestID", foreignKey: ["Guest", "ID"], unique: true }),
    EmailType({ name: "emailAddress" }),
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
