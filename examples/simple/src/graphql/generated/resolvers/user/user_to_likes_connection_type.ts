/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfigMap,
  GraphQLNonNull,
  GraphQLObjectType,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import {
  GraphQLConnectionType,
  GraphQLEdge,
  GraphQLNodeInterface,
  GraphQLTime,
} from "@snowtop/ent/graphql";
import { UserToLikesEdge } from "../../../../ent";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

var connType: GraphQLConnectionType<
  GraphQLObjectType,
  UserToLikesEdge,
  ExampleViewerAlias
>;

export const UserToLikesConnectionType = () => {
  if (connType === undefined) {
    connType = new GraphQLConnectionType("UserToLikes", GraphQLNodeInterface, {
      fields: (): GraphQLFieldConfigMap<
        GraphQLEdge<UserToLikesEdge>,
        RequestContext<ExampleViewerAlias>
      > => ({
        time: {
          type: new GraphQLNonNull(GraphQLTime),
          resolve: (
            edge: GraphQLEdge<UserToLikesEdge>,
            args: {},
            context: RequestContext<ExampleViewerAlias>,
          ) => {
            return edge.edge.getTime();
          },
        },
      }),
    });
  }
  return connType;
};
