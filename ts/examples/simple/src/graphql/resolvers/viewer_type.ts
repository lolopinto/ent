import {
  GraphQLObjectType,
  GraphQLFieldConfig,
  GraphQLResolveInfo,
  GraphQLFieldConfigMap,
} from "graphql";
import { userType } from "./user_type";
import { Viewer } from "ent/ent";
import { Context } from "src/graphql/context";
import User from "src/ent/user";

export const viewerType = new GraphQLObjectType({
  name: "Viewer",
  description: "logged in User",
  fields: (): GraphQLFieldConfigMap<
    Viewer,
    Context,
    { [argName: string]: any }
  > => ({
    user: {
      type: userType,
      description: "logged in user",
      resolve: async (viewer: Viewer) => {
        if (!viewer.viewerID) {
          return null;
        }
        return User.load(viewer, viewer.viewerID);
      },
    },
  }),
});

export const viewerQuery: GraphQLFieldConfig<undefined, Context, {}> = {
  type: viewerType,
  resolve: async (_source, args, context, _info: GraphQLResolveInfo) => {
    return context.viewer;
  },
};
