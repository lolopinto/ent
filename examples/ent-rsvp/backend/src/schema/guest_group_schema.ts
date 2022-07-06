import { ActionOperation, StringType, UUIDType, EntSchema } from "@snowtop/ent";

const GuestGroupSchema = new EntSchema({
  fields: {
    InvitationName: StringType(),
    EventID: UUIDType({
      foreignKey: { schema: "Event", column: "ID" },
    }),
  },

  actions: [
    {
      operation: ActionOperation.Create,
      actionOnlyFields: [
        {
          name: "guests",
          list: true,
          nullable: true,
          type: "Object",
          actionName: "CreateGuestAction",
          excludedFields: ["eventID", "guestGroupID"],
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
  ],
});
export default GuestGroupSchema;
