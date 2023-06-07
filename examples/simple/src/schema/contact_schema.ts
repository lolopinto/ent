import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
  UUIDListType,
} from "@snowtop/ent/schema/";
import Feedback from "./patterns/feedback";

const ContactSchema = new EntSchema({
  patterns: [new Feedback()],

  fields: {
    email_ids: UUIDListType({
      index: true,
      defaultValueOnCreate: () => [],
      fieldEdge: { schema: "ContactEmail" },
    }),
    phone_number_ids: UUIDListType({
      index: true,
      defaultValueOnCreate: () => [],
      fieldEdge: { schema: "ContactPhoneNumber" },
    }),
    firstName: StringType(),
    lastName: StringType(),
    userID: UUIDType({
      immutable: true,
      foreignKey: { schema: "User", column: "ID" },
    }),
  },

  fieldOverrides: {
    createdAt: {
      index: true,
    },
  },

  // create, edit, delete
  actions: [
    {
      operation: ActionOperation.Create,
      excludedFields: ["email_ids", "phone_number_ids"],
      actionOnlyFields: [
        {
          name: "emails",
          list: true,
          nullable: true,
          type: "Object",
          actionName: "CreateContactEmailAction",
          excludedFields: ["contactID"],
        },
        {
          name: "phoneNumbers",
          list: true,
          nullable: true,
          type: "Object",
          actionName: "CreateContactPhoneNumberAction",
          excludedFields: ["contactID"],
        },
      ],
      canViewerDo: {
        inputFields: ["userID"],
      },
    },
    {
      operation: ActionOperation.Edit,
    },
    {
      operation: ActionOperation.Delete,
    },
  ],
});
export default ContactSchema;
