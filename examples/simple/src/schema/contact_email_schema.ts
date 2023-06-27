import {
  ActionOperation,
  EntSchema,
  EnumType,
  UUIDType,
} from "@snowtop/ent/schema/";
import { EmailType } from "@snowtop/ent-email";
import { getLoaderInfoFromSchema } from "../ent/generated/loaders";
import ContactInfo from "./patterns/contact_info";

const ContactEmailSchema = new EntSchema({
  patterns: [new ContactInfo()],

  fields: {
    emailAddress: EmailType(),
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
      operation: ActionOperation.Create,
      canViewerDo: {
        addAllFields: true,
      },
    },
    {
      operation: ActionOperation.Edit,
      canViewerDo: {},
    },
    {
      operation: ActionOperation.Delete,
    },
  ],
});
export default ContactEmailSchema;
