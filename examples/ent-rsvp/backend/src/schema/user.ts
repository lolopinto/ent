import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
} from "@lolopinto/ent";
import { EmailType } from "@lolopinto/ent-email";
import { PasswordType } from "@lolopinto/ent-password";

export default class User extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    EmailType({ name: "EmailAddress", unique: true }),
    PasswordType({ name: "Password" }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      fields: ["FirstName", "LastName", "EmailAddress", "Password"],
    },
  ];
}
