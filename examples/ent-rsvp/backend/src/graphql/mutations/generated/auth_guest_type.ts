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
import { AuthGuestPayload, AuthResolver } from "../auth/auth";

interface AuthGuestInput {
  emailAddress: string;
  code: string;
}

export const AuthGuestInputType = new GraphQLInputObjectType({
  name: "AuthGuestInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    emailAddress: {
      type: new GraphQLNonNull(GraphQLString),
    },
    code: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});

export const AuthGuestPayloadType = new GraphQLObjectType({
  name: "AuthGuestPayload",
  fields: (): GraphQLFieldConfigMap<AuthGuestPayload, RequestContext> => ({
    token: {
      type: new GraphQLNonNull(GraphQLString),
    },
    viewer: {
      type: new GraphQLNonNull(ViewerTypeType),
    },
  }),
});

export const AuthGuestType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: AuthGuestInput }
> = {
  type: new GraphQLNonNull(AuthGuestPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(AuthGuestInputType),
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
