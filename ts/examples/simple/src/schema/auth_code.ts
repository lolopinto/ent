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
import { PhoneNumberType } from "@lolopinto/ent-phonenumber";

// TODO hide entire node from graphql
export default class AuthCode extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "code" }),
    UUIDType({ name: "userID", foreignKey: ["User", "ID"] }),
    EmailType({ name: "emailAddress", nullable: true }),
    PhoneNumberType({ name: "phoneNumber", nullable: true }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      hideFromGraphQL: true,
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
