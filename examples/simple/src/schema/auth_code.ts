import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Constraint,
  ConstraintType,
  Field,
  StringType,
  UUIDType,
} from "@snowtop/snowtop-ts";
import { EmailType } from "@snowtop/snowtop-email";
import { PhoneNumberType } from "@snowtop/snowtop-phonenumber";

export default class AuthCode extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "code" }),
    UUIDType({ name: "userID", foreignKey: { schema: "User", column: "ID" } }),
    EmailType({ name: "emailAddress", nullable: true }),
    PhoneNumberType({ name: "phoneNumber", nullable: true }),
  ];

  hideFromGraphQL = true;

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
    },
    {
      operation: ActionOperation.Delete,
    },
  ];

  constraints: Constraint[] = [
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
  ];
}
