import {
  Schema,
  Action,
  ActionOperation,
  Field,
  BaseEntSchema,
  StringType,
  UUIDType,
  UUIDListType,
} from "@snowtop/ent/schema/";
import Feedback from "./patterns/feedback";

export default class Contact extends BaseEntSchema implements Schema {
  constructor() {
    super();
    this.addPatterns(new Feedback());
  }

  fields: Field[] = [
    UUIDListType({ name: "email_ids", defaultValueOnCreate: () => [] }),
    UUIDListType({ name: "phone_number_ids", defaultValueOnCreate: () => [] }),
    StringType({ name: "firstName" }),
    StringType({ name: "lastName" }),
    UUIDType({ name: "userID", foreignKey: { schema: "User", column: "ID" } }),
  ];

  // create, edit, delete
  actions: Action[] = [
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
        },
        {
          name: "phoneNumbers",
          list: true,
          nullable: true,
          type: "Object",
          actionName: "CreateContactPhoneNumberAction",
        },
      ],
    },
    {
      operation: ActionOperation.Edit,
    },
    {
      operation: ActionOperation.Delete,
    },
  ];
}
