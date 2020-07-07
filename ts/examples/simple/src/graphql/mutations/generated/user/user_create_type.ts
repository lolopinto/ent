// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

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
import { UserType } from "src/graphql/resolvers/generated/user_type";
import CreateUserAction, {
  UserCreateInput,
} from "src/ent/user/actions/create_user_action";
import User from "src/ent/user";

interface UserCreateResponse {
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
    phoneNumber: {
      type: GraphQLString,
    },
    password: {
      type: GraphQLString,
    },
  }),
});

export const UserCreateResponseType = new GraphQLObjectType({
  name: "UserCreateResponse",
  fields: (): GraphQLFieldConfigMap<UserCreateResponse, Context> => ({
    user: {
      type: GraphQLNonNull(UserType),
    },
  }),
});

export const UserCreateType: GraphQLFieldConfig<
  undefined,
  Context,
  { [input: string]: UserCreateInput }
> = {
  type: GraphQLNonNull(UserCreateResponseType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(UserCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: Context,
    _info: GraphQLResolveInfo,
  ): Promise<UserCreateResponse> => {
    let user = await CreateUserAction.create(context.getViewer(), {
      firstName: input.firstName,
      lastName: input.lastName,
      emailAddress: input.emailAddress,
      phoneNumber: input.phoneNumber,
      password: input.password,
    }).saveX();
    return { user: user };
  },
};
