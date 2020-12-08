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

// TODO hide entire node from graphql
export default class AuthCode extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "code" }),
    UUIDType({ name: "userID", foreignKey: ["User", "ID"] }),
    EmailType({ name: "emailAddress" }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      hideFromGraphQL: true,
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
