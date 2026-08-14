import { ActionOperation, EntSchema, EnumType } from "@snowtop/ent/schema";
import { PhoneNumberType } from "@snowtop/ent-phonenumber";
import ContactInfo from "./patterns/contact_info.js";
import Feedback from "./patterns/feedback.js";

const ContactPhoneNumberSchema = new EntSchema({
  patterns: [new ContactInfo(), new Feedback()],

  fields: {
    phoneNumber: PhoneNumberType(),
    label: EnumType({
      globalType: "ContactLabel",
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
