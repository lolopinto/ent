// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { GuestType, UserType } from "src/graphql/resolvers/internal";
import ViewerResolver from "src/graphql/resolvers/viewer";
import { GraphQLViewer } from "src/graphql/resolvers/viewer_type";

export const ViewerType = new GraphQLObjectType({
  name: "Viewer",
  fields: (): GraphQLFieldConfigMap<GraphQLViewer, RequestContext<Viewer>> => ({
    user: {
      type: UserType,
      resolve: async (
        obj: GraphQLViewer,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return obj.user();
      },
    },
    guest: {
      type: GuestType,
      resolve: async (
        obj: GraphQLViewer,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return obj.guest();
      },
    },
  }),
  isTypeOf(obj) {
    return obj instanceof GraphQLViewer;
  },
});

export const ViewerQueryType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  {}
> = {
  type: ViewerType,
  resolve: async (
    _source,
    {},
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ) => {
    const r = new ViewerResolver();
    return r.viewer(context);
  },
};
