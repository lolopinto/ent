import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
} from "@snowtop/snowtop-ts";
import { EmailType } from "@snowtop/snowtop-email";
import { PasswordType } from "@snowtop/snowtop-password";

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
