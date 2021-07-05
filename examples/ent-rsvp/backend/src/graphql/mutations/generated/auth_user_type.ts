// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { ViewerTypeType } from "src/graphql/resolvers/internal";
import { AuthResolver, AuthUserPayload } from "../auth/auth";

interface AuthUserInput {
  emailAddress: string;
  password: string;
}

export const AuthUserInputType = new GraphQLInputObjectType({
  name: "AuthUserInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    password: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

export const AuthUserPayloadType = new GraphQLObjectType({
  name: "AuthUserPayload",
  fields: (): GraphQLFieldConfigMap<AuthUserPayload, RequestContext> => ({
    token: {
      type: GraphQLNonNull(GraphQLString),
    },
    viewer: {
      type: GraphQLNonNull(ViewerTypeType),
    },
  }),
});

export const AuthUserType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: AuthUserInput }
> = {
  type: GraphQLNonNull(AuthUserPayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(AuthUserInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<AuthUserPayload> => {
    const r = new AuthResolver();
    return r.authUser(context, {
      emailAddress: input.emailAddress,
      password: input.password,
    });
  },
};
