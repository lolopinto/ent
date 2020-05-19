// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLResolveInfo,
  GraphQLInputFieldConfigMap,
} from "graphql";
import { ID } from "ent/ent";
import { Context } from "src/graphql/context";
import { UserType } from "src/graphql/resolvers/generated/user_type.ts";
import { UserEditInput } from "src/ent/user/actions/edit_user_action";
import User from "src/ent/user";
import EditUserAction from "src/ent/user/actions/edit_user_action";

interface customUserEditInput extends UserEditInput {
  userID: ID;
}

export const UserEditInputType = new GraphQLInputObjectType({
  name: "UserEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    userID: {
      type: GraphQLNonNull(GraphQLID),
    },
    firstName: {
      type: GraphQLString,
    },
    lastName: {
      type: GraphQLString,
    },
  }),
});
interface UserEditResponse {
  user: User;
}

export const UserEditResponseType = new GraphQLObjectType({
  name: "UserEditResponse",
  fields: (): GraphQLFieldConfigMap<User, Context> => ({
    user: {
      type: GraphQLNonNull(UserType),
    },
  }),
});

export const UserEditType: GraphQLFieldConfig<
  undefined,
  Context,
  customUserEditInput
> = {
  type: GraphQLNonNull(UserEditResponseType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(UserEditInputType),
    },
  },
  resolve: async (
    _source,
    args: customUserEditInput,
    context: Context,
    _info: GraphQLResolveInfo,
  ): Promise<UserEditResponse> => {
    let user = await EditUserAction.saveXFromID(context.viewer, args.id, {
      firstName: args.firstName,
      lastName: args.lastName,
    });
    return { user: user };
  },
};
