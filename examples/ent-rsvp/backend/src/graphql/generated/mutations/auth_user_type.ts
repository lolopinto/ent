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
import { RequestContext, Viewer } from "@snowtop/ent";
import { AuthResolver } from "src/graphql/mutations/auth/auth";
import {
  AuthUserInput,
  AuthUserPayload,
} from "src/graphql/mutations/auth/auth_types";
import { ViewerTypeType } from "src/graphql/resolvers/internal";

export const AuthUserInputType = new GraphQLInputObjectType({
  name: "AuthUserInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    emailAddress: {
      type: new GraphQLNonNull(GraphQLString),
    },
    password: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});

export const AuthUserPayloadType = new GraphQLObjectType({
  name: "AuthUserPayload",
  fields: (): GraphQLFieldConfigMap<
    AuthUserPayload,
    RequestContext<Viewer>
  > => ({
    token: {
      type: new GraphQLNonNull(GraphQLString),
    },
    viewer: {
      type: new GraphQLNonNull(ViewerTypeType),
    },
  }),
  isTypeOf(obj) {
    return obj instanceof AuthUserPayload;
  },
});

export const AuthUserType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  { [input: string]: AuthUserInput }
> = {
  type: new GraphQLNonNull(AuthUserPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(AuthUserInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ): Promise<AuthUserPayload> => {
    const r = new AuthResolver();
    return r.authUser(context, {
      emailAddress: input.emailAddress,
      password: input.password,
    });
  },
};
