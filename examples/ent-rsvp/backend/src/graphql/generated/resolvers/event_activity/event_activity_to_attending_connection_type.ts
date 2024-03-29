// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfigMap,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { GraphQLConnectionType, GraphQLEdge } from "@snowtop/ent/graphql";
import { EventActivityToAttendingEdge } from "src/ent/";
import { GuestType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<
  GraphQLObjectType,
  EventActivityToAttendingEdge,
  Viewer
>;

export const EventActivityToAttendingConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType(
      "EventActivityToAttending",
      GuestType,
      {
        fields: (): GraphQLFieldConfigMap<
          GraphQLEdge<EventActivityToAttendingEdge>,
          RequestContext<Viewer>
        > => ({
          dietaryRestrictions: {
            type: GraphQLString,
            resolve: async (
              edge: GraphQLEdge<EventActivityToAttendingEdge>,
              args: {},
              context: RequestContext<Viewer>,
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
