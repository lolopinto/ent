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
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import DeleteContactPhoneNumberAction from "../../../../ent/contact_phone_number/actions/delete_contact_phone_number_action";
import { ExampleViewer } from "../../../../viewer/viewer";

interface customContactPhoneNumberDeleteInput {
  contactPhoneNumberID: string;
}

interface ContactPhoneNumberDeletePayload {
  deletedContactPhoneNumberID: string;
}

export const ContactPhoneNumberDeleteInputType = new GraphQLInputObjectType({
  name: "ContactPhoneNumberDeleteInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    contactPhoneNumberID: {
      description: "id of ContactPhoneNumber",
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
});

export const ContactPhoneNumberDeletePayloadType = new GraphQLObjectType({
  name: "ContactPhoneNumberDeletePayload",
  fields: (): GraphQLFieldConfigMap<
    ContactPhoneNumberDeletePayload,
    RequestContext
  > => ({
    deletedContactPhoneNumberID: {
      type: GraphQLID,
    },
  }),
});

export const ContactPhoneNumberDeleteType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewer>,
  { [input: string]: customContactPhoneNumberDeleteInput }
> = {
  type: new GraphQLNonNull(ContactPhoneNumberDeletePayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(ContactPhoneNumberDeleteInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewer>,
    _info: GraphQLResolveInfo,
  ): Promise<ContactPhoneNumberDeletePayload> => {
    await DeleteContactPhoneNumberAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.contactPhoneNumberID),
    );
    return { deletedContactPhoneNumberID: input.contactPhoneNumberID };
  },
};
