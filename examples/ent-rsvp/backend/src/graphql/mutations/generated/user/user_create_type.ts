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
import { User } from "src/ent/";
import CreateUserAction, {
  UserCreateInput,
} from "src/ent/user/actions/create_user_action";
import { UserType } from "src/graphql/resolvers/";

interface UserCreatePayload {
  user: User;
}

export const UserCreateInputType = new GraphQLInputObjectType({
  name: "UserCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    firstName: {
      type: GraphQLNonNull(GraphQLString),
    },
    lastName: {
      type: GraphQLNonNull(GraphQLString),
    },
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    password: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

export const UserCreatePayloadType = new GraphQLObjectType({
  name: "UserCreatePayload",
  fields: (): GraphQLFieldConfigMap<UserCreatePayload, RequestContext> => ({
    user: {
      type: GraphQLNonNull(UserType),
    },
  }),
});

export const UserCreateType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: UserCreateInput }
> = {
  type: GraphQLNonNull(UserCreatePayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(UserCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<UserCreatePayload> => {
    let user = await CreateUserAction.create(context.getViewer(), {
      firstName: input.firstName,
      lastName: input.lastName,
      emailAddress: input.emailAddress,
      password: input.password,
    }).saveX();
    return { user: user };
  },
};
