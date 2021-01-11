import {
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
  Action,
} from "@lolopinto/ent";

export default class GuestGroup extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "InvitationName" }),
    UUIDType({ name: "EventID", foreignKey: ["Event", "ID"] }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
