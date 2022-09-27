// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@snowtop/ent/graphql";
import { AccountToClosedTodosDupEdge } from "src/ent/";
import { TodoType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<
  GraphQLObjectType,
  AccountToClosedTodosDupEdge
>;

export const AccountToClosedTodosDupConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("AccountToClosedTodosDup", TodoType);
  }
  return connType;
};
