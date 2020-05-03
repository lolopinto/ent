import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLNonNull,
  GraphQLInputObjectType,
  GraphQLFieldConfig,
} from "graphql";
import DeleteUserAction from "src/ent/user/actions/delete_user_action";
import { Context } from "src/graphql/context";
import User from "src/ent/user";
import { ID } from "ent/ent";

export const userDeleteInput = new GraphQLInputObjectType({
  name: "UserDeleteInput",
  description: "input for deleter user",
  fields: () => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
      description: "id of user",
    },
  }),
});

export const userDeleteResponseType = new GraphQLObjectType({
  name: "UserDeleteResponse",
  description: "response for deleting a user",
  fields: () => ({
    deletedUserID: {
      type: GraphQLNonNull(GraphQLID),
      description: "deleted user id",
    },
  }),
});

// TODO eventually support doing more things in here
interface userDeleteResponse {
  deletedUserID?: ID;
}

// todo this is more readable as a class that builds these things up.
export const userDeleteType: GraphQLFieldConfig<
  undefined,
  Context,
  { [argName: string]: any }
> = {
  type: GraphQLNonNull(userDeleteResponseType),
  description: "delete user",
  args: {
    input: {
      description: "input args",
      type: GraphQLNonNull(userDeleteInput),
    },
  },
  resolve: async (
    _source,
    { input },
    context: Context,
  ): Promise<userDeleteResponse | null> => {
    let user = await User.load(context.viewer, input.id);
    if (!user) {
      return null;
    }
    await DeleteUserAction.create(context.viewer, user).saveX();
    return {
      deletedUserID: user.id,
    };
  },
};
