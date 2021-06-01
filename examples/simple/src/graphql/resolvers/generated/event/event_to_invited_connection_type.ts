// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@lolopinto/ent/graphql";
import { EventToInvitedEdge } from "src/ent/";
import { UserType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<GraphQLObjectType, EventToInvitedEdge>;

export const EventToInvitedConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("EventToInvited", UserType);
  }
  return connType;
};
