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
import { getLoaderInfoFromSchema } from "../ent/generated/loaders";

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
        getLoaderInfoFromSchema: getLoaderInfoFromSchema,
      },
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
