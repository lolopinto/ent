import {
  ActionOperation,
  EntSchema,
  EnumType,
  UUIDType,
} from "@snowtop/ent/schema/";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import { getLoaderInfoFromSchema } from "../ent/generated/loaders";
import ContactInfo from "./patterns/contact_info";

const ContactPhoneNumberSchema = new EntSchema({
  patterns: [new ContactInfo()],

  fields: {
    phoneNumber: PhoneNumberType(),
    label: EnumType({
      values: ["work", "home", "default", "unknown"],
    }),
    contactID: UUIDType({
      immutable: true,
      fieldEdge: {
        schema: "Contact",
        enforceSchema: true,
        getLoaderInfoFromSchema: getLoaderInfoFromSchema,
      },
    }),
  },

  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});
export default ContactPhoneNumberSchema;
