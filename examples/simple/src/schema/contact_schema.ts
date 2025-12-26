import {
  ActionOperation,
  EntSchema,
  StringType,
  UUIDType,
  UUIDListType,
  StructTypeAsList,
  StructType,
  DateType,
} from "@snowtop/ent/schema/";
import Feedback from "./patterns/feedback";

const ContactSchema = new EntSchema({
  patterns: [new Feedback()],

  fields: {
    email_ids: UUIDListType({
      index: true,
      defaultValueOnCreate: () => [],
      fieldEdge: {
        schema: "ContactEmail",
        inverseEdge: { name: "emailsForContacts" },
      },
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
      foreignKey: { schema: "User", column: "id" },
    }),
    // example struct that nests date fields for manual testing
    importantDates: StructType({
      nullable: true,
      tsType: "ImportantDates",
      fields: {
        firstMet: DateType(),
        lastSpoken: DateType({ nullable: true }),
      },
    }),
    attachments: StructTypeAsList({
      nullable: true,
      globalType: "Attachment",
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
      actionOnlyFields: [
        {
          name: "emails",
          list: true,
          nullable: true,
          type: "Object",
          actionName: "EditContactEmailAction",
        },
      ],
    },
    {
      operation: ActionOperation.Delete,
    },
  ],
});
export default ContactSchema;
