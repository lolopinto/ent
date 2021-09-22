import {
  Schema,
  Action,
  ActionOperation,
  Field,
  BaseEntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema/";
import { EmailType } from "@snowtop/ent-email";
import Feedback from "./patterns/feedback";

export default class Contact extends BaseEntSchema implements Schema {
  constructor() {
    super();
    this.addPatterns(new Feedback());
  }

  fields: Field[] = [
    EmailType({ name: "emailAddress" }),
    StringType({ name: "firstName" }),
    StringType({ name: "lastName" }),
    UUIDType({ name: "userID", foreignKey: { schema: "User", column: "ID" } }),
  ];

  // create, edit, delete
  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
