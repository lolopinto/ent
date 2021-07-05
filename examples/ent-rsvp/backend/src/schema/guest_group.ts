import {
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
  Action,
} from "@snowtop/ent";

export default class GuestGroup extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "InvitationName" }),
    UUIDType({
      name: "EventID",
      foreignKey: { schema: "Event", column: "ID" },
    }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      actionOnlyFields: [
        {
          name: "guests",
          list: true,
          nullable: true,
          type: "Object",
          actionName: "CreateGuestAction",
        },
      ],
    },
    {
      operation: ActionOperation.Edit,
      fields: ["InvitationName"],
    },
    {
      operation: ActionOperation.Delete,
    },
  ];
}
