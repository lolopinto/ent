// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLObjectType,
  GraphQLResolveInfo,
} from "graphql";
import { RequestContext } from "@lolopinto/ent";
import { GuestType, UserType } from "src/graphql/resolvers/internal";
import ViewerResolver, { ViewerType } from "../viewer";

export const ViewerTypeType = new GraphQLObjectType({
  name: "Viewer",
  fields: (): GraphQLFieldConfigMap<ViewerType, RequestContext> => ({
    user: {
      type: UserType,
      resolve: async (obj: ViewerType, args: {}, context: RequestContext) => {
        return obj.user();
      },
    },
    guest: {
      type: GuestType,
      resolve: async (obj: ViewerType, args: {}, context: RequestContext) => {
        return obj.guest();
      },
    },
  }),
});

export const ViewerQueryType: GraphQLFieldConfig<undefined, RequestContext> = {
  type: ViewerTypeType,
  resolve: async (
    _source,
    {},
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    const r = new ViewerResolver();
    return r.viewer(context);
  },
};
