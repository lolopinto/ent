// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  GraphQLInt,
  GraphQLFieldConfigMap,
} from "graphql";
import { RequestContext } from "@lolopinto/ent";
import {
  GraphQLNodeInterface,
  nodeIDEncoder,
  GraphQLEdgeConnection,
} from "@lolopinto/ent/graphql";
import {
  GuestType,
  EventType,
  GuestGroupToInvitedEventsConnectionType,
} from "src/graphql/resolvers/";
import { GuestGroup, GuestGroupToInvitedEventsQuery } from "src/ent/";

export const GuestGroupType = new GraphQLObjectType({
  name: "GuestGroup",
  fields: (): GraphQLFieldConfigMap<GuestGroup, RequestContext> => ({
    event: {
      type: EventType,
      resolve: (guestGroup: GuestGroup, args: {}) => {
        return guestGroup.loadEvent();
      },
    },
    id: {
      type: GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    invitationName: {
      type: GraphQLNonNull(GraphQLString),
    },
    guestGroupToInvitedEvents: {
      type: GraphQLNonNull(GuestGroupToInvitedEventsConnectionType()),
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
      resolve: (guestGroup: GuestGroup, args: {}) => {
        return new GraphQLEdgeConnection(
          guestGroup.viewer,
          guestGroup,
          GuestGroupToInvitedEventsQuery,
          args,
        );
      },
    },
    guests: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(GuestType))),
      resolve: (guestGroup: GuestGroup, args: {}) => {
        return guestGroup.loadGuests();
      },
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof GuestGroup;
  },
});
