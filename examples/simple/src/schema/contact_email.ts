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

export default class ContactEmail extends BaseEntSchema implements Schema {
  fields: Field[] = [
    EmailType({ name: "emailAddress" }),
    StringType({ name: "label" }),
    UUIDType({
      name: "contactID",
      foreignKey: { schema: "Contact", column: "ID" },
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
