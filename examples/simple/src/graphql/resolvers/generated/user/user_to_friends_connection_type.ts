/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@snowtop/ent/graphql";
import { UserToFriendsEdge } from "../../../../ent";
import { UserType } from "../../internal";

var connType: GraphQLConnectionType<GraphQLObjectType, UserToFriendsEdge>;

export const UserToFriendsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("UserToFriends", UserType);
  }
  return connType;
};
