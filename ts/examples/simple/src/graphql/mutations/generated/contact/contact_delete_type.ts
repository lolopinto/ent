// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLID,
  GraphQLNonNull,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLResolveInfo,
  GraphQLInputFieldConfigMap,
} from "graphql";
import { ID } from "ent/core/ent";
import { RequestContext } from "ent/auth/context";
import Contact from "src/ent/contact";
import DeleteContactAction from "src/ent/contact/actions/delete_contact_action";

interface customContactDeleteInput {
  contactID: ID;
}

interface ContactDeleteResponse {
  deletedContactID: ID;
}

export const ContactDeleteInputType = new GraphQLInputObjectType({
  name: "ContactDeleteInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    contactID: {
      type: GraphQLNonNull(GraphQLID),
    },
  }),
});

export const ContactDeleteResponseType = new GraphQLObjectType({
  name: "ContactDeleteResponse",
  fields: (): GraphQLFieldConfigMap<ContactDeleteResponse, RequestContext> => ({
    deletedContactID: {
      type: GraphQLID,
    },
  }),
});

export const ContactDeleteType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customContactDeleteInput }
> = {
  type: GraphQLNonNull(ContactDeleteResponseType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(ContactDeleteInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<ContactDeleteResponse> => {
    await DeleteContactAction.saveXFromID(context.getViewer(), input.contactID);
    return { deletedContactID: input.contactID };
  },
};
