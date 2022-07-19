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
import { User } from "../../../../ent";
import ConfirmEditPhoneNumberAction, {
  ConfirmEditPhoneNumberInput,
} from "../../../../ent/user/actions/confirm_edit_phone_number_action";
import { UserType } from "../../../resolvers";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

interface customConfirmEditPhoneNumberInput
  extends ConfirmEditPhoneNumberInput {
  id: string;
}

interface ConfirmEditPhoneNumberPayload {
  user: User;
}

export const ConfirmEditPhoneNumberInputType = new GraphQLInputObjectType({
  name: "ConfirmEditPhoneNumberInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of User",
      type: new GraphQLNonNull(GraphQLID),
    },
    phoneNumber: {
      type: new GraphQLNonNull(GraphQLString),
    },
    code: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});

export const ConfirmEditPhoneNumberPayloadType = new GraphQLObjectType({
  name: "ConfirmEditPhoneNumberPayload",
  fields: (): GraphQLFieldConfigMap<
    ConfirmEditPhoneNumberPayload,
    RequestContext
  > => ({
    user: {
      type: new GraphQLNonNull(UserType),
    },
  }),
});

export const ConfirmPhoneNumberEditType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: customConfirmEditPhoneNumberInput }
> = {
  type: new GraphQLNonNull(ConfirmEditPhoneNumberPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(ConfirmEditPhoneNumberInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<ConfirmEditPhoneNumberPayload> => {
    const user = await ConfirmEditPhoneNumberAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.id),
      {
        phoneNumber: input.phoneNumber,
        code: input.code,
      },
    );
    return { user: user };
  },
};
