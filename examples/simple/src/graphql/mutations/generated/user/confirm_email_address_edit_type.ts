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
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { User } from "src/ent/";
import ConfirmEditEmailAddressAction, {
  ConfirmEditEmailAddressInput,
} from "src/ent/user/actions/confirm_edit_email_address_action";
import { UserType } from "src/graphql/resolvers/";

interface customConfirmEmailAddressEditInput
  extends ConfirmEditEmailAddressInput {
  userID: string;
}

interface ConfirmEmailAddressEditPayload {
  user: User;
}

export const ConfirmEmailAddressEditInputType = new GraphQLInputObjectType({
  name: "ConfirmEmailAddressEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    userID: {
      type: GraphQLNonNull(GraphQLID),
    },
    emailAddress: {
      type: GraphQLNonNull(GraphQLString),
    },
    code: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

export const ConfirmEmailAddressEditPayloadType = new GraphQLObjectType({
  name: "ConfirmEmailAddressEditPayload",
  fields: (): GraphQLFieldConfigMap<
    ConfirmEmailAddressEditPayload,
    RequestContext
  > => ({
    user: {
      type: GraphQLNonNull(UserType),
    },
  }),
});

export const ConfirmEmailAddressEditType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customConfirmEmailAddressEditInput }
> = {
  type: GraphQLNonNull(ConfirmEmailAddressEditPayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(ConfirmEmailAddressEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<ConfirmEmailAddressEditPayload> => {
    let user = await ConfirmEditEmailAddressAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.userID),
      {
        emailAddress: input.emailAddress,
        code: input.code,
      },
    );
    return { user: user };
  },
};
