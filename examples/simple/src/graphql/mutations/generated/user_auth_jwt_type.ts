// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { AuthResolver } from "../auth";
import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { ID, RequestContext } from "@lolopinto/ent";

interface UserAuthJWTInput {
  emailAddress: string;
  password: string;
}

interface UserAuthJWTPayload {
  token: string;
  viewerID: ID;
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

export const UserAuthJWTPayloadType = new GraphQLObjectType({
  name: "UserAuthJWTPayload",
  fields: (): GraphQLFieldConfigMap<UserAuthJWTPayload, RequestContext> => ({
    token: {
      type: GraphQLNonNull(GraphQLString),
    },
    viewerID: {
      type: GraphQLNonNull(GraphQLID),
    },
  }),
});

export const UserAuthJWTType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: UserAuthJWTInput }
> = {
  type: GraphQLNonNull(UserAuthJWTPayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(UserAuthJWTInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<UserAuthJWTPayload> => {
    const r = new AuthResolver();
    return r.userAuthJWT(context, {
      emailAddress: input.emailAddress,
      password: input.password,
    });
  },
};
