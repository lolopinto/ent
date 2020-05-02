import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLNonNull,
  GraphQLInputObjectType,
  GraphQLFieldConfig,
} from "graphql";
import { userType } from "src/graphql/resolvers/user_type";
import CreateUserAction from "src/ent/user/actions/create_user_action";
import { Context } from "src/graphql/context";

const userCreateInputType = new GraphQLInputObjectType({
  name: "UserCreateInput",
  description: "inputs for creating user",
  fields: () => ({
    firstName: {
      type: GraphQLNonNull(GraphQLString),
      description: "firstName",
    },
    lastName: {
      type: GraphQLNonNull(GraphQLString),
      description: "lastName",
    },
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
      description: "emailAddress",
    },
  }),
});

const userCreateResponseType = new GraphQLObjectType({
  name: "UserCreateResponse",
  description: "response for creating a user",
  fields: () => ({
    user: {
      type: GraphQLNonNull(userType),
      description: "created user",
    },
  }),
});

// todo this is more readable as a class that builds these things up.
// TODO GraphQLFieldConfig
export const userCreateType = {
  type: GraphQLNonNull(userCreateResponseType),
  description: "create user",
  args: {
    input: {
      description: "input args",
      type: GraphQLNonNull(userCreateInputType),
    },
  },
  resolve: async (_source, { input }, context: Context) => {
    // can't load user back because of privacy so this is expected
    // TODO need to handle this especially because it negatively affects demo...
    // actually, can load. why?
    // privacy bug?
    let user = await CreateUserAction.create(context.viewer, {
      firstName: input.firstName,
      lastName: input.lastName,
      emailAddress: input.emailAddress,
    }).saveX();
    return {
      user: user,
    };
  },
};
