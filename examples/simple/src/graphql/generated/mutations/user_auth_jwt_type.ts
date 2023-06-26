/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

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
import { RequestContext } from "@snowtop/ent";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";
import { AuthResolver } from "../../mutations/auth";
import {
  UserAuthJWTInput,
  UserAuthJWTPayload,
} from "../../mutations/auth_types";

export const UserAuthJWTInputType = new GraphQLInputObjectType({
  name: "UserAuthJWTInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    emailAddress: {
      type: new GraphQLNonNull(GraphQLString),
    },
    password: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});

export const UserAuthJWTPayloadType = new GraphQLObjectType({
  name: "UserAuthJWTPayload",
  fields: (): GraphQLFieldConfigMap<
    UserAuthJWTPayload,
    RequestContext<ExampleViewerAlias>
  > => ({
    token: {
      type: new GraphQLNonNull(GraphQLString),
    },
    viewerID: {
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
  isTypeOf(obj) {
    return obj instanceof UserAuthJWTPayload;
  },
});

export const UserAuthJWTType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: UserAuthJWTInput }
> = {
  type: new GraphQLNonNull(UserAuthJWTPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(UserAuthJWTInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<UserAuthJWTPayload> => {
    const r = new AuthResolver();
    return r.userAuthJWT(context, {
      emailAddress: input.emailAddress,
      password: input.password,
    });
  },
};
