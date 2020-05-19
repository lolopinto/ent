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
import { Context } from "src/graphql/context";
import { GraphQLTime } from "ent/graphql/scalars/time";
import { ContactType } from "src/graphql/resolvers/generated/contact_type.ts";
import { ContactCreateInput } from "src/ent/contact/actions/create_contact_action";
import Contact from "src/ent/contact";
import CreateContactAction from "src/ent/contact/actions/create_contact_action";

export const ContactCreateInputType = new GraphQLInputObjectType({
  name: "ContactCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
    createdAt: {
      type: GraphQLNonNull(GraphQLTime),
    },
    updatedAt: {
      type: GraphQLNonNull(GraphQLTime),
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
  }),
});
interface ContactCreateResponse {
  contact: Contact;
}

export const ContactCreateResponseType = new GraphQLObjectType({
  name: "ContactCreateResponse",
  fields: (): GraphQLFieldConfigMap<Contact, Context> => ({
    contact: {
      type: GraphQLNonNull(ContactType),
    },
  }),
});

export const ContactCreateType: GraphQLFieldConfig<
  undefined,
  Context,
  ContactCreateInput
> = {
  type: GraphQLNonNull(ContactCreateResponseType),
  args: {
    input: {
      description: "input for action",
      type: GraphQLNonNull(ContactCreateInputType),
    },
  },
  resolve: async (
    _source,
    args: ContactCreateInput,
    context: Context,
    _info: GraphQLResolveInfo,
  ): Promise<ContactCreateResponse> => {
    let contact = await CreateContactAction.create(context.viewer, {
      id: args.id,
      emailAddress: args.emailAddress,
      firstName: args.firstName,
      lastName: args.lastName,
    }).saveX();
    return { contact: contact };
  },
};
