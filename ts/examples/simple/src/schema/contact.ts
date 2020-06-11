import Schema, {
  Action,
  ActionOperation,
  Field,
  BaseEntSchema,
} from "ent/schema";
import { StringType } from "ent/field";
import { EmailType } from "ent/field/email";

export default class Contact extends BaseEntSchema implements Schema {
  fields: Field[] = [
    EmailType({ name: "emailAddress" }),
    StringType({ name: "firstName" }),
    StringType({ name: "lastName" }),
    StringType({ name: "userID", foreignKey: ["User", "ID"] }),
  ];

  // create, edit, delete
  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
