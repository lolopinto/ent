import {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLResolveInfo,
  GraphQLInputFieldConfigMap,
} from "graphql";
import { Context } from "ent/auth/context";
import { useAndAuth, LocalStrategy } from "ent/auth/passport";
import User from "src/ent/user";
import { IDViewer } from "src/util/id_viewer";
import { ID } from "ent/ent";

interface UserAuthResponse {
  token: string;
  viewerID: ID;
}

interface UserAuthInput {
  emailAddress: string;
  password: string;
}

export const UserAuthInputType = new GraphQLInputObjectType({
  name: "UserAuthInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    password: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

export const UserAuthResponseType = new GraphQLObjectType({
  name: "UserAuthResponse",
  fields: (): GraphQLFieldConfigMap<UserAuthResponse, Context> => ({
    token: {
      type: GraphQLNonNull(GraphQLString),
    },
    viewerID: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

class OmniViewer extends IDViewer {
  isOmniscient(): boolean {
    return true;
  }
}
export const UserAuthType: GraphQLFieldConfig<
  undefined,
  Context,
  { [input: string]: UserAuthInput }
> = {
  type: GraphQLNonNull(UserAuthResponseType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(UserAuthInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: Context,
    _info: GraphQLResolveInfo,
  ): Promise<UserAuthResponse> => {
    await useAndAuth(
      context,
      new LocalStrategy({
        verifyFn: async () => {
          // we need load raw here
          const user = await User.loadFromEmailAddress(
            // This leads to invalid uuid so we need to account for this
            //            new OmniViewer("1"),
            new OmniViewer("b38e3d04-4f6a-4421-a566-a211f4799c12"),
            input.emailAddress,
          );

          if (!user) {
            return null;
          }

          let valid = await user.verifyPassword(input.password);
          if (!valid) {
            return null;
          }
          return new IDViewer(user.id);
        },
      }),
    );

    return {
      viewerID: context.getViewer().viewerID || "",
      token: "1",
    };
  },
};
