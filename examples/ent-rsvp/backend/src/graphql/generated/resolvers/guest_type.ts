// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
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
  AddressType,
  EventType,
  GuestGroupType,
  GuestToAttendingEventsConnectionType,
  GuestToDeclinedEventsConnectionType,
} from "src/graphql/resolvers/internal";

export const GuestType = new GraphQLObjectType({
  name: "Guest",
  fields: (): GraphQLFieldConfigMap<Guest, RequestContext<Viewer>> => ({
    address: {
      type: AddressType,
      resolve: (obj: Guest, args: {}, context: RequestContext<Viewer>) => {
        return obj.loadAddress();
      },
    },
    event: {
      type: EventType,
      resolve: (obj: Guest, args: {}, context: RequestContext<Viewer>) => {
        return obj.loadEvent();
      },
    },
    guestGroup: {
      type: GuestGroupType,
      resolve: (obj: Guest, args: {}, context: RequestContext<Viewer>) => {
        return obj.loadGuestGroup();
      },
    },
    id: {
      type: new GraphQLNonNull(GraphQLID),
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
    guestDataId: {
      type: GraphQLID,
      resolve: nodeIDEncoder,
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
      resolve: (obj: Guest, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Guest) => GuestToAttendingEventsQuery.query(v, obj),
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
      resolve: (obj: Guest, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: Guest) => GuestToDeclinedEventsQuery.query(v, obj),
          args,
        );
      },
    },
  }),
  interfaces: () => [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Guest;
  },
});
