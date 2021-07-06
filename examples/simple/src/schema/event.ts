import {
  Schema,
  Action,
  Field,
  Edge,
  BaseEntSchema,
  ActionOperation,
  StringType,
  TimestampType,
  UUIDType,
  AssocEdgeGroup,
} from "@snowtop/ent/schema/";

/// explicit schema
export default class Event extends BaseEntSchema implements Schema {
  fields: Field[] = [
    StringType({ name: "name" }),
    // TODO this should be an id type...
    // we should warn when we see an "ID/id/Id" field as non-id type and ask if they wanna change it
    UUIDType({
      name: "creatorID",
      fieldEdge: { schema: "User", inverseEdge: "createdEvents" },
      storageKey: "user_id",
    }),
    TimestampType({ name: "start_time" }),
    TimestampType({ name: "end_time", nullable: true }),
    StringType({
      name: "location",
      graphqlName: "eventLocation",
    }),
  ];

  edges: Edge[] = [
    {
      name: "hosts",
      schemaName: "User",
      inverseEdge: {
        name: "userToHostedEvents",
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
  ];

  edgeGroups: AssocEdgeGroup[] = [
    {
      name: "rsvps",
      groupStatusName: "rsvpStatus",
      nullStates: ["canRsvp"],
      statusEnums: ["attending", "declined", "maybe"],
      edgeAction: {
        operation: ActionOperation.EdgeGroup,
      },
      assocEdges: [
        {
          name: "invited",
          schemaName: "User",
          inverseEdge: {
            name: "invitedEvents",
          },
        },
        {
          // yes
          name: "attending",
          schemaName: "User",
          inverseEdge: {
            name: "eventsAttending",
          },
        },
        {
          // no
          name: "declined",
          schemaName: "User",
          inverseEdge: {
            name: "declinedEvents",
          },
        },
        {
          // maybe
          name: "maybe",
          schemaName: "User",
          inverseEdge: {
            name: "maybeEvents",
          },
        },
      ],
    },
  ];

  // create, edit, delete
  actions: Action[] = [
    {
      operation: ActionOperation.Mutations,
    },
  ];
}
