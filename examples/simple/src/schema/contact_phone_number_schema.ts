import {
  ActionOperation,
  EntSchema,
  EnumType,
  UUIDType,
} from "@snowtop/ent/schema/";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import { getLoaderInfoFromSchema } from "../ent/generated/loaders";
import ContactInfo from "./patterns/contact_info";
import Feedback from "./patterns/feedback";

const ContactPhoneNumberSchema = new EntSchema({
  patterns: [new ContactInfo(), new Feedback()],

  fields: {
    phoneNumber: PhoneNumberType(),
    label: EnumType({
      globalType: "ContactLabel",
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

  customGraphQLInterfaces: ["ContactItem"],

  actions: [
    {
      operation: ActionOperation.Mutations,
    },
  ],
});
export default ContactPhoneNumberSchema;
