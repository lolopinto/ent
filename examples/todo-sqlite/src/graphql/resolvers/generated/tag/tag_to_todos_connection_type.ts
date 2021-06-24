// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@snowtop/snowtop-ts/graphql";
import { TagToTodosEdge } from "src/ent/";
import { TodoType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<GraphQLObjectType, TagToTodosEdge>;

export const TagToTodosConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("TagToTodos", TodoType);
  }
  return connType;
};
