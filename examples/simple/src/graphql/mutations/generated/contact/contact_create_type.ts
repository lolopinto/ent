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
import { RequestContext } from "@lolopinto/ent";
import { mustDecodeIDFromGQLID } from "@lolopinto/ent/graphql";
import { Contact } from "src/ent/";
import CreateContactAction, {
  ContactCreateInput,
} from "src/ent/contact/actions/create_contact_action";
import { ContactType } from "src/graphql/resolvers/";

interface customContactCreateInput extends ContactCreateInput {
  userID: string;
}

interface ContactCreatePayload {
  contact: Contact;
}

export const ContactCreateInputType = new GraphQLInputObjectType({
  name: "ContactCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
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
      type: GraphQLNonNull(GraphQLID),
    },
  }),
});

export const ContactCreatePayloadType = new GraphQLObjectType({
  name: "ContactCreatePayload",
  fields: (): GraphQLFieldConfigMap<ContactCreatePayload, RequestContext> => ({
    contact: {
      type: GraphQLNonNull(ContactType),
    },
  }),
});

export const ContactCreateType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customContactCreateInput }
> = {
  type: GraphQLNonNull(ContactCreatePayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(ContactCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<ContactCreatePayload> => {
    let contact = await CreateContactAction.create(context.getViewer(), {
      emailAddress: input.emailAddress,
      firstName: input.firstName,
      lastName: input.lastName,
      userID: mustDecodeIDFromGQLID(input.userID),
    }).saveX();
    return { contact: contact };
  },
};
