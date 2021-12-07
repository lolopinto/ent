/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { Contact } from "../../../../ent";
import EditContactAction, {
  ContactEditInput,
} from "../../../../ent/contact/actions/edit_contact_action";
import { ContactType } from "../../../resolvers";

interface customContactEditInput extends ContactEditInput {
  contactID: string;
  userID: string;
}

interface ContactEditPayload {
  contact: Contact;
}

export const ContactEditInputType = new GraphQLInputObjectType({
  name: "ContactEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    contactID: {
      description: "id of Contact",
      type: GraphQLNonNull(GraphQLID),
    },
    emailAddress: {
      type: GraphQLString,
    },
    firstName: {
      type: GraphQLString,
    },
    lastName: {
      type: GraphQLString,
    },
    userID: {
      type: GraphQLID,
    },
  }),
});

export const ContactEditPayloadType = new GraphQLObjectType({
  name: "ContactEditPayload",
  fields: (): GraphQLFieldConfigMap<ContactEditPayload, RequestContext> => ({
    contact: {
      type: GraphQLNonNull(ContactType),
    },
  }),
});

export const ContactEditType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customContactEditInput }
> = {
  type: GraphQLNonNull(ContactEditPayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(ContactEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<ContactEditPayload> => {
    const contact = await EditContactAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.contactID),
      {
        emailAddress: input.emailAddress,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    );
    return { contact: contact };
  },
};
