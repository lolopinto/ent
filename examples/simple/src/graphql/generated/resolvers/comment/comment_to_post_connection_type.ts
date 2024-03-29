/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { GraphQLObjectType } from "graphql";
import {
  GraphQLConnectionType,
  GraphQLNodeInterface,
} from "@snowtop/ent/graphql";
import { CommentToPostEdge } from "../../../../ent";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

var connType: GraphQLConnectionType<
  GraphQLObjectType,
  CommentToPostEdge,
  ExampleViewerAlias
>;

export const CommentToPostConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("CommentToPost", GraphQLNodeInterface);
  }
  return connType;
};
