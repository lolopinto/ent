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
import { RequestContext } from "@lolopinto/ent";
import { ViewerTypeType } from "src/graphql/resolvers/internal";
import { AuthGuestPayload, AuthResolver } from "../auth/auth";

interface AuthGuestInput {
  emailAddress: string;
  code: string;
}

export const AuthGuestInputType = new GraphQLInputObjectType({
  name: "AuthGuestInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    code: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

export const AuthGuestPayloadType = new GraphQLObjectType({
  name: "AuthGuestPayload",
  fields: (): GraphQLFieldConfigMap<AuthGuestPayload, RequestContext> => ({
    token: {
      type: GraphQLNonNull(GraphQLString),
    },
    viewer: {
      type: GraphQLNonNull(ViewerTypeType),
    },
  }),
});

export const AuthGuestType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: AuthGuestInput }
> = {
  type: GraphQLNonNull(AuthGuestPayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(AuthGuestInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<AuthGuestPayload> => {
    const r = new AuthResolver();
    return r.authGuest(context, {
      emailAddress: input.emailAddress,
      code: input.code,
    });
  },
};
