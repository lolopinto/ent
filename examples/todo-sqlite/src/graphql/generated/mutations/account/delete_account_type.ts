// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

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
import { RequestContext, Viewer } from "@snowtop/ent";
import DeleteAccountAction from "src/ent/account/actions/delete_account_action";

interface customDeleteAccountInput {
  id: string;
}

interface DeleteAccountPayload {
  deleted_account_id: string;
}

export const DeleteAccountInputType = new GraphQLInputObjectType({
  name: "DeleteAccountInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Account",
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
});

export const DeleteAccountPayloadType = new GraphQLObjectType({
  name: "DeleteAccountPayload",
  fields: (): GraphQLFieldConfigMap<DeleteAccountPayload, RequestContext> => ({
    deleted_account_id: {
      type: GraphQLID,
    },
  }),
});

export const DeleteAccountType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  { [input: string]: customDeleteAccountInput }
> = {
  type: new GraphQLNonNull(DeleteAccountPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(DeleteAccountInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ): Promise<DeleteAccountPayload> => {
    await DeleteAccountAction.saveXFromID(context.getViewer(), input.id);
    return { deleted_account_id: input.id };
  },
};
