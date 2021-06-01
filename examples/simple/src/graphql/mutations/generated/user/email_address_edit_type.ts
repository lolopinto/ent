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
import { User } from "src/ent/";
import EditEmailAddressAction, {
  EditEmailAddressInput,
} from "src/ent/user/actions/edit_email_address_action";
import { UserType } from "src/graphql/resolvers/";

interface customEmailAddressEditInput extends EditEmailAddressInput {
  userID: string;
}

interface EmailAddressEditPayload {
  user: User;
}

export const EmailAddressEditInputType = new GraphQLInputObjectType({
  name: "EmailAddressEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    userID: {
      type: GraphQLNonNull(GraphQLID),
    },
    newEmail: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

export const EmailAddressEditPayloadType = new GraphQLObjectType({
  name: "EmailAddressEditPayload",
  fields: (): GraphQLFieldConfigMap<
    EmailAddressEditPayload,
    RequestContext
  > => ({
    user: {
      type: GraphQLNonNull(UserType),
    },
  }),
});

export const EmailAddressEditType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customEmailAddressEditInput }
> = {
  type: GraphQLNonNull(EmailAddressEditPayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(EmailAddressEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<EmailAddressEditPayload> => {
    let user = await EditEmailAddressAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.userID),
      {
        newEmail: input.newEmail,
      },
    );
    return { user: user };
  },
};
