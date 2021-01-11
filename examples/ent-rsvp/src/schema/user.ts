import { BaseEntSchema, Field, StringType } from "@lolopinto/ent";
import { EmailType } from "@lolopinto/ent-email";

export default class User extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    EmailType({ name: "EmailAddress", unique: true }),
  ];
}
