// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLResolveInfo,
} from "graphql";
import { ID } from "ent/ent";
import { Context } from "src/graphql/context";
import { UserType } from "./user_type";
import Contact from "src/ent/contact";

interface ContactQueryArgs {
  id: ID;
}

export const ContactType = new GraphQLObjectType({
  name: "Contact",
  fields: (): GraphQLFieldConfigMap<Contact, Context> => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    firstName: {
      type: GraphQLNonNull(GraphQLString),
    },
    lastName: {
      type: GraphQLNonNull(GraphQLString),
    },
    userID: {
      type: GraphQLNonNull(GraphQLString),
    },
    user: {
      type: UserType,
      resolve: (contact: Contact) => {
        return contact.loadUser();
      },
    },
  }),
});

export const ContactQuery: GraphQLFieldConfig<
  undefined,
  Context,
  ContactQueryArgs
> = {
  type: ContactType,
  args: {
    id: {
      description: "id",
      type: GraphQLNonNull(GraphQLID),
    },
  },
  resolve: async (
    _source,
    args: ContactQueryArgs,
    context: Context,
    _info: GraphQLResolveInfo,
  ) => {
    return Contact.load(context.viewer, args.id);
  },
};
