import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLInputObjectType,
  GraphQLFieldConfig,
  GraphQLID,
} from "graphql";
import { userType } from "src/graphql/resolvers/user_type";
import EditUserAction from "src/ent/user/actions/edit_user_action";
import User from "src/ent/user";
import { Context } from "src/graphql/context";

export const userEditInput = new GraphQLInputObjectType({
  name: "UserEditInput",
  description: "inputs for editing user",
  fields: () => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
      description: "id of user",
    },
    firstName: {
      type: GraphQLString,
      description: "firstName",
    },
    lastName: {
      type: GraphQLString,
      description: "lastName",
    },
  }),
});

export const userEditResponseType = new GraphQLObjectType({
  name: "UserEditResponse",
  description: "response for editing a user",
  fields: () => ({
    user: {
      type: GraphQLNonNull(userType),
      description: "edited user",
    },
  }),
});

interface userEditResponse {
  user?: User;
}

// todo this is more readable as a class that builds these things up.
export const userEditType: GraphQLFieldConfig<
  undefined,
  Context,
  { [argName: string]: any }
> = {
  type: GraphQLNonNull(userEditResponseType),
  description: "edit user",
  args: {
    input: {
      description: "input args",
      type: GraphQLNonNull(userEditInput),
    },
  },
  resolve: async (
    _source,
    { input },
    context: Context,
  ): Promise<userEditResponse | null> => {
    // TODO edit from id...
    // TODO can we differentiate null from undefined here?
    // yup!
    // so we need to make sure we test this correctly
    console.log(input);
    let user = await User.load(context.viewer, input.id);
    if (!user) {
      return null;
    }
    // can't load user back because of privacy so this is expected
    // TODO need to handle this especially because it negatively affects demo...
    let editedUser = await EditUserAction.create(context.viewer, user, {
      firstName: input.firstName,
      lastName: input.lastName,
    }).saveX();
    return {
      user: editedUser,
    };
  },
};
