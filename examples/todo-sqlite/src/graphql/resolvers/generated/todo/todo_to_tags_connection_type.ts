// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { GraphQLObjectType } from "graphql";
import { GraphQLConnectionType } from "@lolopinto/ent/graphql";
import { TodoToTagsEdge } from "src/ent/";
import { TagType } from "src/graphql/resolvers/internal";

var connType: GraphQLConnectionType<GraphQLObjectType, TodoToTagsEdge>;

export const TodoToTagsConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("TodoToTags", TagType);
  }
  return connType;
};
