import {
  ActionOperation,
  BaseEntSchema,
  Field,
  StringType,
  UUIDType,
  Action,
  TimeType,
  Edge,
} from "@lolopinto/ent";

export default class EventActivity extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "Name" }),
    UUIDType({ name: "eventID", foreignKey: ["Event", "ID"] }),
    TimeType({ name: "StartTime" }),
    TimeType({ name: "EndTime", nullable: true }),
    // Name of location, not address. TODO address
    StringType({ name: "Location" }),
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];

  edges: Edge[] = [
    {
      name: "rsvp",
      groupStatusName: "rsvpStatus",
      tableName: "event_rsvps",
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
