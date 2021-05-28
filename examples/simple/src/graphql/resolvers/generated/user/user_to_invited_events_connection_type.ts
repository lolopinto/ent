// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@lolopinto/ent/graphql";
import { EventType } from "src/graphql/resolvers/internal";
import { UserToInvitedEventsEdge } from "src/ent/";

var connType: GraphQLConnectionType<GraphQLObjectType, UserToInvitedEventsEdge>;

export const UserToInvitedEventsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("UserToInvitedEvents", EventType);
  }
  return connType;
};
