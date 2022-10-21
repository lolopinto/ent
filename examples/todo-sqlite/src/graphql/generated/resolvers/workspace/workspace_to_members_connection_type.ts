// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@snowtop/ent/graphql";
import { WorkspaceToMembersEdge } from "src/ent/";
import { AccountType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<GraphQLObjectType, WorkspaceToMembersEdge>;

export const WorkspaceToMembersConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("WorkspaceToMembers", AccountType);
  }
  return connType;
};