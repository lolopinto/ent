import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema/";
import { EmailType } from "@snowtop/ent-email";
import { getLoaderInfoFromSchema } from "../ent/generated/loaders";
import ContactInfo from "./patterns/contact_info";

const ContactEmailSchema = new EntSchema({
  patterns: [new ContactInfo()],

  fields: {
    emailAddress: EmailType(),
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
export default ContactEmailSchema;
