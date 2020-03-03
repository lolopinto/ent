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
    // can either do this or something like above with creator id and inverse edge somewhere else
    // up to user.
    // test this somewhere else...
    // {
    //   name: "creator",
    //   unique: true,
    //   schemaName: "User",
    //   // inverseEdge: {
    //   //   name: "createdEvents",
    //   // },
    // },
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