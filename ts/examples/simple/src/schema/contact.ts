import Schema, {
  Action,
  ActionOperation,
  Field,
  BaseEntSchema,
} from "ent/schema/schema";
import { StringType } from "ent/schema/field";
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
