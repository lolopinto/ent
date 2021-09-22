/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { UserType } from "../internal";
import ViewerResolver, { GQLViewer } from "../viewer";

export const GQLViewerType = new GraphQLObjectType({
  name: "Viewer",
  fields: (): GraphQLFieldConfigMap<GQLViewer, RequestContext> => ({
    viewerID: {
      type: GraphQLID,
      resolve: async (obj: GQLViewer, args: {}, context: RequestContext) => {
        return obj.viewerID();
      },
    },
    user: {
      type: UserType,
      resolve: async (obj: GQLViewer, args: {}, context: RequestContext) => {
        return obj.user();
      },
    },
  }),
});

export const ViewerQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  {}
> = {
  type: GraphQLNonNull(GQLViewerType),
  resolve: async (
    _source,
    args: {},
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    const r = new ViewerResolver();
    return r.viewer(context);
  },
};
