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
import DeleteContactAction from "../../../../ent/contact/actions/delete_contact_action";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

interface customContactDeleteInput {
  id: string;
}

interface ContactDeletePayload {
  deletedContactID: string;
}

export const ContactDeleteInputType = new GraphQLInputObjectType({
  name: "ContactDeleteInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Contact",
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
});

export const ContactDeletePayloadType = new GraphQLObjectType({
  name: "ContactDeletePayload",
  fields: (): GraphQLFieldConfigMap<ContactDeletePayload, RequestContext> => ({
    deletedContactID: {
      type: GraphQLID,
    },
  }),
});

export const ContactDeleteType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: customContactDeleteInput }
> = {
  type: new GraphQLNonNull(ContactDeletePayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(ContactDeleteInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<ContactDeletePayload> => {
    await DeleteContactAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.id),
    );
    return { deletedContactID: input.id };
  },
};
