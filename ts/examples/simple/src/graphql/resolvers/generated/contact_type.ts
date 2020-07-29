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
import { ID } from "ent/core/ent";
import { RequestContext } from "ent/auth/context";
import { UserType } from "./user_type";
import Contact from "src/ent/contact";

interface ContactQueryArgs {
  id: ID;
}

export const ContactType = new GraphQLObjectType({
  name: "Contact",
  fields: (): GraphQLFieldConfigMap<Contact, RequestContext> => ({
    user: {
      type: UserType,
      resolve: (contact: Contact) => {
        return contact.loadUser();
      },
    },
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
  }),
});

export const ContactQuery: GraphQLFieldConfig<
  undefined,
  RequestContext,
  ContactQueryArgs
> = {
  type: ContactType,
  args: {
    id: {
      description: "",
      type: GraphQLNonNull(GraphQLID),
    },
  },
  resolve: async (
    _source,
    args: ContactQueryArgs,
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    return Contact.load(context.getViewer(), args.id);
  },
};
