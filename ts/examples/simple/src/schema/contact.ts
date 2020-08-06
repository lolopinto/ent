import {
  Schema,
  Action,
  ActionOperation,
  Field,
  BaseEntSchema,
  StringType,
} from "@lolopinto/ent/schema/";
import { EmailType } from "@lolopinto/ent-email";

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
