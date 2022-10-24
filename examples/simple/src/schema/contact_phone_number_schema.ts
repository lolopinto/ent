import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema/";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import { getLoaderInfoFromSchema } from "../ent/generated/loaders";
import ContactInfo from "./patterns/contact_info";

const ContactPhoneNumberSchema = new EntSchema({
  patterns: [new ContactInfo()],

  fields: {
    phoneNumber: PhoneNumberType(),
    label: StringType(),
    contactID: UUIDType({
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
