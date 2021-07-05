// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@snowtop/ent/graphql";
import { UserToFriendsEdge } from "src/ent/";
import { UserType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<GraphQLObjectType, UserToFriendsEdge>;

export const UserToFriendsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("UserToFriends", UserType);
  }
  return connType;
};
