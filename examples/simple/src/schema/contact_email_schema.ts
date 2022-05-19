import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
} from "@snowtop/ent/schema/";
import { EmailType } from "@snowtop/ent-email";
import { getLoaderInfoFromSchema } from "../ent/generated/loaders";

const ContactEmail = new EntSchema({
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
export default ContactEmail;
