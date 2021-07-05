// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfigMap,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import {
  GraphQLConnectionType,
  GraphQLEdge,
} from "@snowtop/ent/graphql";
import { GuestToAttendingEventsEdge } from "src/ent/";
import { EventActivityType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<
  GraphQLObjectType,
  GuestToAttendingEventsEdge
>;

export const GuestToAttendingEventsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType(
      "GuestToAttendingEvents",
      EventActivityType,
      {
        fields: (): GraphQLFieldConfigMap<
          GraphQLEdge<GuestToAttendingEventsEdge>,
          RequestContext
        > => ({
          dietaryRestrictions: {
            type: GraphQLString,
            resolve: async (
              edge: GraphQLEdge<GuestToAttendingEventsEdge>,
              args: {},
              context: RequestContext,
            ) => {
              return edge.edge.dietaryRestrictions(context);
            },
          },
        }),
      },
    );
  }
  return connType;
};
