import {
  Schema,
  Action,
  ActionOperation,
  Field,
  BaseEntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema/";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";

export default class ContactPhoneNumber
  extends BaseEntSchema
  implements Schema
{
  fields: Field[] = [
    PhoneNumberType({ name: "phoneNumber" }),
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
