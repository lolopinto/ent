// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@lolopinto/ent/graphql";
import { EventType } from "src/graphql/resolvers/internal";
import { UserToEventsAttendingEdge } from "src/ent/";

var connType: GraphQLConnectionType<
  GraphQLObjectType,
  UserToEventsAttendingEdge
>;

export const UserToEventsAttendingConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("UserToEventsAttending", EventType);
  }
  return connType;
};
