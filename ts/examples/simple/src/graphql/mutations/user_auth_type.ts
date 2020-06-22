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
import { ID } from "ent/ent";
import { AuthResolver } from "./auth";

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
    const r = new AuthResolver();
    return r.userAuth(context, {
      emailAddress: input.emailAddress,
      password: input.password,
    });
  },
};
