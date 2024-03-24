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
import { ContactEmail } from "../../../../ent";
import CreateContactEmailAction, {
  ContactEmailCreateInput,
} from "../../../../ent/contact_email/actions/create_contact_email_action";
import { ContactInfoInputType } from "../input/contact_info_input_type";
import { ContactEmailType, ContactLabelType } from "../../../resolvers";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

interface customContactEmailCreateInput extends ContactEmailCreateInput {
  contactId: string;
  ownerId: string;
}

interface ContactEmailCreatePayload {
  contactEmail: ContactEmail;
}

export const ContactEmailCreateInputType = new GraphQLInputObjectType({
  name: "ContactEmailCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    extra: {
      type: ContactInfoInputType,
    },
    contactId: {
      type: new GraphQLNonNull(GraphQLID),
    },
    ownerId: {
      type: new GraphQLNonNull(GraphQLID),
    },
    emailAddress: {
      type: new GraphQLNonNull(GraphQLString),
    },
    label: {
      type: new GraphQLNonNull(ContactLabelType),
    },
  }),
});

export const ContactEmailCreatePayloadType = new GraphQLObjectType({
  name: "ContactEmailCreatePayload",
  fields: (): GraphQLFieldConfigMap<
    ContactEmailCreatePayload,
    RequestContext<ExampleViewerAlias>
  > => ({
    contactEmail: {
      type: new GraphQLNonNull(ContactEmailType),
    },
  }),
});

export const ContactEmailCreateType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: customContactEmailCreateInput }
> = {
  type: new GraphQLNonNull(ContactEmailCreatePayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(ContactEmailCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<ContactEmailCreatePayload> => {
    const contactEmail = await CreateContactEmailAction.create(
      context.getViewer(),
      {
        extra: input.extra,
        contactId: mustDecodeIDFromGQLID(input.contactId),
        ownerId: mustDecodeIDFromGQLID(input.ownerId),
        emailAddress: input.emailAddress,
        label: input.label,
      },
    ).saveX();
    return { contactEmail: contactEmail };
  },
};
