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

interface UserAuthJWTResponse {
  token: string;
  viewerID: ID;
}

interface UserAuthJWTInput {
  emailAddress: string;
  password: string;
}

export const UserAuthJWTInputType = new GraphQLInputObjectType({
  name: "UserAuthJWTInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    password: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

export const UserAuthJWTResponseType = new GraphQLObjectType({
  name: "UserAuthJWTResponse",
  fields: (): GraphQLFieldConfigMap<UserAuthJWTResponse, Context> => ({
    token: {
      type: GraphQLNonNull(GraphQLString),
    },
    viewerID: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

export const UserAuthJWTType: GraphQLFieldConfig<
  undefined,
  Context,
  { [input: string]: UserAuthJWTInput }
> = {
  type: GraphQLNonNull(UserAuthJWTResponseType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(UserAuthJWTInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: Context,
    _info: GraphQLResolveInfo,
  ): Promise<UserAuthJWTResponse> => {
    const r = new AuthResolver();

    return r.userAuthJWT(context, {
      emailAddress: input.emailAddress,
      password: input.password,
    });
  },
};
