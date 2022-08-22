// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import {
  GraphQLEdgeConnection,
  GraphQLNodeInterface,
  GraphQLTime,
  nodeIDEncoder,
} from "@snowtop/ent/graphql";
import {
  EventActivity,
  EventActivityToAttendingQuery,
  EventActivityToDeclinedQuery,
  EventActivityToInvitesQuery,
} from "src/ent/";
import {
  AddressType,
  EventActivityRsvpStatusType,
  EventActivityToAttendingConnectionType,
  EventActivityToDeclinedConnectionType,
  EventActivityToInvitesConnectionType,
  EventType,
} from "src/graphql/resolvers/internal";

export const EventActivityType = new GraphQLObjectType({
  name: "EventActivity",
  fields: (): GraphQLFieldConfigMap<EventActivity, RequestContext> => ({
    address: {
      type: AddressType,
      resolve: (
        eventActivity: EventActivity,
        args: {},
        context: RequestContext,
      ) => {
        return eventActivity.loadAddress();
      },
    },
    event: {
      type: EventType,
      resolve: (
        eventActivity: EventActivity,
        args: {},
        context: RequestContext,
      ) => {
        return eventActivity.loadEvent();
      },
    },
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    startTime: {
      type: new GraphQLNonNull(GraphQLTime),
    },
    endTime: {
      type: GraphQLTime,
    },
    location: {
      type: new GraphQLNonNull(GraphQLString),
    },
    description: {
      type: GraphQLString,
    },
    inviteAllGuests: {
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    attending: {
      type: new GraphQLNonNull(EventActivityToAttendingConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (
        eventActivity: EventActivity,
        args: {},
        context: RequestContext,
      ) => {
        return new GraphQLEdgeConnection(
          eventActivity.viewer,
          eventActivity,
          (v, eventActivity: EventActivity) =>
            EventActivityToAttendingQuery.query(v, eventActivity),
          args,
        );
      },
    },
    declined: {
      type: new GraphQLNonNull(EventActivityToDeclinedConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (
        eventActivity: EventActivity,
        args: {},
        context: RequestContext,
      ) => {
        return new GraphQLEdgeConnection(
          eventActivity.viewer,
          eventActivity,
          (v, eventActivity: EventActivity) =>
            EventActivityToDeclinedQuery.query(v, eventActivity),
          args,
        );
      },
    },
    invites: {
      type: new GraphQLNonNull(EventActivityToInvitesConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (
        eventActivity: EventActivity,
        args: {},
        context: RequestContext,
      ) => {
        return new GraphQLEdgeConnection(
          eventActivity.viewer,
          eventActivity,
          (v, eventActivity: EventActivity) =>
            EventActivityToInvitesQuery.query(v, eventActivity),
          args,
        );
      },
    },
    viewerRsvpStatus: {
      type: EventActivityRsvpStatusType,
    },
    addressFromOwner: {
      type: AddressType,
      resolve: async (
        eventActivity: EventActivity,
        args: {},
        context: RequestContext,
      ) => {
        return eventActivity.address();
      },
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof EventActivity;
  },
});
