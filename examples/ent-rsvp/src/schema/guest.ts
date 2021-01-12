import {
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
  Action,
} from "@lolopinto/ent";
import { EmailType } from "@lolopinto/ent-email";

export default class Guest extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "FirstName" }),
    StringType({ name: "LastName" }),
    EmailType({ name: "EmailAddress" }),
    UUIDType({ name: "eventID", foreignKey: ["Event", "ID"] }),
    UUIDType({ name: "guestGroupID", foreignKey: ["GuestGroup", "ID"] }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
