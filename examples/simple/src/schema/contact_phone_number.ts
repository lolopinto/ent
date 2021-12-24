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
import { getLoaderOptions } from "../ent/generated/loadAny";

export default class ContactPhoneNumber
  extends BaseEntSchema
  implements Schema
{
  fields: Field[] = [
    PhoneNumberType({ name: "phoneNumber" }),
    StringType({ name: "label" }),
    UUIDType({
      name: "contactID",
      fieldEdge: {
        schema: "Contact",
        enforceSchema: true,
        loadRowByType: getLoaderOptions,
      },
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
