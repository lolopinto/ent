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
  GuestGroup,
  GuestGroupToGuestsQuery,
  GuestGroupToInvitedEventsQuery,
} from "src/ent/";
import {
  EventType,
  GuestGroupToGuestsConnectionType,
  GuestGroupToInvitedEventsConnectionType,
} from "src/graphql/resolvers/internal";

export const GuestGroupType = new GraphQLObjectType({
  name: "GuestGroup",
  fields: (): GraphQLFieldConfigMap<GuestGroup, RequestContext> => ({
    event: {
      type: EventType,
      resolve: (guestGroup: GuestGroup, args: {}, context: RequestContext) => {
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
      resolve: (guestGroup: GuestGroup, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          guestGroup.viewer,
          guestGroup,
          (v, guestGroup: GuestGroup) =>
            GuestGroupToInvitedEventsQuery.query(v, guestGroup),
          args,
        );
      },
    },
    guests: {
      type: GraphQLNonNull(GuestGroupToGuestsConnectionType()),
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
      resolve: (guestGroup: GuestGroup, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          guestGroup.viewer,
          guestGroup,
          (v, guestGroup: GuestGroup) =>
            GuestGroupToGuestsQuery.query(v, guestGroup),
          args,
        );
      },
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof GuestGroup;
  },
});
