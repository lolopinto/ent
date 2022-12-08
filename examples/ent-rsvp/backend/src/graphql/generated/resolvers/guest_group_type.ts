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
  fields: (): GraphQLFieldConfigMap<GuestGroup, RequestContext<Viewer>> => ({
    event: {
      type: EventType,
      resolve: (
        guestGroup: GuestGroup,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return guestGroup.loadEvent();
      },
    },
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    invitationName: {
      type: new GraphQLNonNull(GraphQLString),
    },
    guestGroupToInvitedEvents: {
      type: new GraphQLNonNull(GuestGroupToInvitedEventsConnectionType()),
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
        guestGroup: GuestGroup,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
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
      type: new GraphQLNonNull(GuestGroupToGuestsConnectionType()),
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
        guestGroup: GuestGroup,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
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
