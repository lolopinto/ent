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
import EditEmailAddressAction, {
  EditEmailAddressInput,
} from "../../../../ent/user/actions/edit_email_address_action";
import { UserType } from "../../../resolvers";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

interface customEditEmailAddressInput extends EditEmailAddressInput {
  id: string;
}

interface EditEmailAddressPayload {
  user: User;
}

export const EditEmailAddressInputType = new GraphQLInputObjectType({
  name: "EditEmailAddressInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of User",
      type: new GraphQLNonNull(GraphQLID),
    },
    newEmail: {
      type: new GraphQLNonNull(GraphQLString),
    },
  }),
});

export const EditEmailAddressPayloadType = new GraphQLObjectType({
  name: "EditEmailAddressPayload",
  fields: (): GraphQLFieldConfigMap<
    EditEmailAddressPayload,
    RequestContext<ExampleViewerAlias>
  > => ({
    user: {
      type: new GraphQLNonNull(UserType),
    },
  }),
});

export const EmailAddressEditType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: customEditEmailAddressInput }
> = {
  type: new GraphQLNonNull(EditEmailAddressPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(EditEmailAddressInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<EditEmailAddressPayload> => {
    const user = await EditEmailAddressAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.id),
      {
        newEmail: input.newEmail,
      },
    );
    return { user: user };
  },
};
