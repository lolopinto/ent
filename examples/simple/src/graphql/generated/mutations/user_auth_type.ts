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
import { UserAuthInput, UserAuthPayload } from "../../mutations/auth_types";

export const UserAuthInputType = new GraphQLInputObjectType({
  name: "UserAuthInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    emailAddress: {
      description: "email address of the user",
      type: new GraphQLNonNull(GraphQLString),
    },
    password: {
      description: "password of the user",
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});

export const UserAuthPayloadType = new GraphQLObjectType({
  name: "UserAuthPayload",
  fields: (): GraphQLFieldConfigMap<
    UserAuthPayload,
    RequestContext<ExampleViewerAlias>
  > => ({
    viewerID: {
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
  isTypeOf(obj) {
    return obj instanceof UserAuthPayload;
  },
});

export const UserAuthType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: UserAuthInput }
> = {
  type: new GraphQLNonNull(UserAuthPayloadType),
  description: "authenticate a user",
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(UserAuthInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<UserAuthPayload> => {
    const r = new AuthResolver();
    return r.userAuth(context, {
      emailAddress: input.emailAddress,
      password: input.password,
    });
  },
};
