import Schema, {Field, Edge, BaseEntSchema} from "./../../../schema"
import {StringType, TimeType} from "./../../../field"

/// explicit schema
export default class Event extends BaseEntSchema implements Schema {
  fields: Field[] = [
    StringType({name: "name"}),
    StringType({name: "creatorID", fieldEdge:["User", "createdEvents"], storageKey: "user_id"}),
    TimeType({name: "start_time"}),
    TimeType({name: "end_time", nullable: true}),
    StringType({name: "location"}),
  ];

  edges: Edge[] = [
    {
      name: "hosts",
      schemaName: "User",
    },
    {
      name: "rsvps",
      groupStatusName: "rsvpStatus",
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
};