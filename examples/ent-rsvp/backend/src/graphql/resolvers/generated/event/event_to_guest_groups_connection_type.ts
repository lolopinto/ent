// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { AssocEdge } from "@lolopinto/ent";
import { GraphQLConnectionType } from "@lolopinto/ent/graphql";
import { GuestGroupType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<GraphQLObjectType, AssocEdge>;

export const EventToGuestGroupsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("EventToGuestGroups", GuestGroupType);
  }
  return connType;
};
