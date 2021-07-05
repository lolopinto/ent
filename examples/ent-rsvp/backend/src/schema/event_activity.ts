import {
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
  Action,
  TimestampType,
  BooleanType,
  AssocEdgeGroup,
} from "@snowtop/ent";

export default class EventActivity extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "Name" }),
    UUIDType({
      name: "eventID",
      foreignKey: { schema: "Event", column: "ID" },
    }),
    TimestampType({ name: "StartTime" }),
    TimestampType({ name: "EndTime", nullable: true }),
    // Name of location, not address. TODO address
    StringType({ name: "Location" }),
    StringType({ name: "Description", nullable: true }),
    BooleanType({ name: "InviteAllGuests", serverDefault: "FALSE" }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      actionOnlyFields: [
        {
          name: "address",
          type: "Object",
          nullable: true,
          actionName: "CreateAddressAction",
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

  edgeGroups: AssocEdgeGroup[] = [
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
  ];
}
