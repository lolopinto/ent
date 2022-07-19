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
import {
  mustDecodeIDFromGQLID,
  mustDecodeNullableIDFromGQLID,
} from "@snowtop/ent/graphql";
import { ContactPhoneNumber } from "../../../../ent";
import EditContactPhoneNumberAction, {
  ContactPhoneNumberEditInput,
} from "../../../../ent/contact_phone_number/actions/edit_contact_phone_number_action";
import { ContactPhoneNumberType } from "../../../resolvers";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

interface customContactPhoneNumberEditInput
  extends ContactPhoneNumberEditInput {
  id: string;
  contactID?: string;
}

interface ContactPhoneNumberEditPayload {
  contactPhoneNumber: ContactPhoneNumber;
}

export const ContactPhoneNumberEditInputType = new GraphQLInputObjectType({
  name: "ContactPhoneNumberEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of ContactPhoneNumber",
      type: new GraphQLNonNull(GraphQLID),
    },
    phoneNumber: {
      type: GraphQLString,
    },
    label: {
      type: GraphQLString,
    },
    contactID: {
      type: GraphQLID,
    },
  }),
});

export const ContactPhoneNumberEditPayloadType = new GraphQLObjectType({
  name: "ContactPhoneNumberEditPayload",
  fields: (): GraphQLFieldConfigMap<
    ContactPhoneNumberEditPayload,
    RequestContext
  > => ({
    contactPhoneNumber: {
      type: new GraphQLNonNull(ContactPhoneNumberType),
    },
  }),
});

export const ContactPhoneNumberEditType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: customContactPhoneNumberEditInput }
> = {
  type: new GraphQLNonNull(ContactPhoneNumberEditPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(ContactPhoneNumberEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<ContactPhoneNumberEditPayload> => {
    const contactPhoneNumber = await EditContactPhoneNumberAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.id),
      {
        phoneNumber: input.phoneNumber,
        label: input.label,
        contactID: mustDecodeNullableIDFromGQLID(input.contactID),
      },
    );
    return { contactPhoneNumber: contactPhoneNumber };
  },
};
