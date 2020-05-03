import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLFieldConfigMap,
} from "graphql";
import { Context } from "src/graphql/context";
import Contact from "src/ent/contact";
import { userType } from "./user_type";
import User from "src/ent/user";

export const contactType = new GraphQLObjectType({
  name: "Contact",
  description: "Contact",
  fields: (): GraphQLFieldConfigMap<
    Contact,
    Context,
    { [argName: string]: any }
  > => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
      description: "id",
    },
    firstName: {
      type: GraphQLNonNull(GraphQLString),
      description: "first name",
    },
    lastName: {
      type: GraphQLNonNull(GraphQLString),
      description: "last name",
    },
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
      description: "emailAddress",
    },
    user: {
      type: userType,
      description: "user who owns contact",
      // maybe use this for single one liners?
      resolve: (contact) => contact.loadUser(),
      // resolve: async (contact: Contact): Promise<User | null> => {
      //   return contact.loadUser();
      // },
    },
  }),
});
