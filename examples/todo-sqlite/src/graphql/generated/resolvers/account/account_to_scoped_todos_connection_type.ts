// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@snowtop/ent/graphql";
import { AccountToScopedTodosEdge } from "src/ent/";
import { TodoType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<
  GraphQLObjectType,
  AccountToScopedTodosEdge
>;

export const AccountToScopedTodosConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("AccountToScopedTodos", TodoType);
  }
  return connType;
};
