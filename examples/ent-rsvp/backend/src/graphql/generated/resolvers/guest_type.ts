// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
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
  nodeIDEncoder,
} from "@snowtop/ent/graphql";
import {
  Guest,
  GuestToAttendingEventsQuery,
  GuestToDeclinedEventsQuery,
} from "src/ent/";
import {
  EventType,
  GuestGroupType,
  GuestToAttendingEventsConnectionType,
  GuestToDeclinedEventsConnectionType,
} from "src/graphql/resolvers/internal";

export const GuestType = new GraphQLObjectType({
  name: "Guest",
  fields: (): GraphQLFieldConfigMap<Guest, RequestContext> => ({
    event: {
      type: EventType,
      resolve: (guest: Guest, args: {}, context: RequestContext) => {
        return guest.loadEvent();
      },
    },
    guestGroup: {
      type: GuestGroupType,
      resolve: (guest: Guest, args: {}, context: RequestContext) => {
        return guest.loadGuestGroup();
      },
    },
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    addressId: {
      type: GraphQLID,
      resolve: nodeIDEncoder,
    },
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    emailAddress: {
      type: GraphQLString,
    },
    title: {
      type: GraphQLString,
    },
    guestToAttendingEvents: {
      type: new GraphQLNonNull(GuestToAttendingEventsConnectionType()),
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
      resolve: (guest: Guest, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          guest.viewer,
          guest,
          (v, guest: Guest) => GuestToAttendingEventsQuery.query(v, guest),
          args,
        );
      },
    },
    guestToDeclinedEvents: {
      type: new GraphQLNonNull(GuestToDeclinedEventsConnectionType()),
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
      resolve: (guest: Guest, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          guest.viewer,
          guest,
          (v, guest: Guest) => GuestToDeclinedEventsQuery.query(v, guest),
          args,
        );
      },
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Guest;
  },
});
