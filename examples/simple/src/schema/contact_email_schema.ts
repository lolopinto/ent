import { ActionOperation, EntSchema, EnumType } from "@snowtop/ent/schema/";
import { EmailType } from "@snowtop/ent-email";
import ContactInfo from "./patterns/contact_info";
import Feedback from "./patterns/feedback";

const ContactEmailSchema = new EntSchema({
  patterns: [new ContactInfo(), new Feedback()],

  fields: {
    emailAddress: EmailType(),
    label: EnumType({
      globalType: "ContactLabel",
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
