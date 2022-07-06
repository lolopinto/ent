import {
  ActionOperation,
  StringType,
  UUIDType,
  TimestampType,
  BooleanType,
  EntSchema,
} from "@snowtop/ent";

const EventActivitySchema = new EntSchema({
  fields: {
    Name: StringType(),
    eventID: UUIDType({
      foreignKey: { schema: "Event", column: "ID" },
    }),
    StartTime: TimestampType(),
    EndTime: TimestampType({ nullable: true }),
    // Name of location, not address. TODO address
    Location: StringType(),
    Description: StringType({ nullable: true }),
    InviteAllGuests: BooleanType({ serverDefault: "FALSE" }),
  },

  actions: [
    {
      operation: ActionOperation.Create,
      actionOnlyFields: [
        {
          name: "address",
          type: "Object",
          nullable: true,
          actionName: "CreateAddressAction",
          excludedFields: ["OwnerID"],
        },
      ],
    },
    {
      operation: ActionOperation.Edit,
    },
    {
      operation: ActionOperation.Delete,
    },
  ],

  edgeGroups: [
    {
      name: "rsvp",
      groupStatusName: "rsvpStatus",
      tableName: "event_rsvps",
      statusEnums: ["attending", "declined"],
      nullStateFn: "rsvpStatus",
      nullStates: ["canRsvp", "cannotRsvp"],
      edgeAction: {
        operation: ActionOperation.EdgeGroup,
        actionOnlyFields: [
          {
            name: "dietaryRestrictions",
            type: "String",
            nullable: true,
          },
        ],
      },
      assocEdges: [
        {
          name: "invites",
          schemaName: "GuestGroup",
          inverseEdge: {
            name: "guestGroupToInvitedEvents",
          },
          edgeActions: [
            {
              operation: ActionOperation.AddEdge,
            },
            {
              operation: ActionOperation.RemoveEdge,
            },
          ],
        },
        {
          name: "attending",
          schemaName: "Guest",
          inverseEdge: {
            name: "guestToAttendingEvents",
          },
        },
        {
          name: "declined",
          schemaName: "Guest",
          inverseEdge: {
            name: "guestToDeclinedEvents",
          },
        },
      ],
    },
  ],
});
export default EventActivitySchema;
