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
import { RequestContext } from "@snowtop/snowtop-ts";
import { mustDecodeIDFromGQLID } from "@snowtop/snowtop-ts/graphql";
import { Guest } from "src/ent/";
import EditGuestAction, {
  GuestEditInput,
} from "src/ent/guest/actions/edit_guest_action";
import { GuestType } from "src/graphql/resolvers/";

interface customGuestEditInput extends GuestEditInput {
  guestID: string;
}

interface GuestEditPayload {
  guest: Guest;
}

export const GuestEditInputType = new GraphQLInputObjectType({
  name: "GuestEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    guestID: {
      type: GraphQLNonNull(GraphQLID),
    },
    name: {
      type: GraphQLString,
    },
    emailAddress: {
      type: GraphQLString,
    },
  }),
});

export const GuestEditPayloadType = new GraphQLObjectType({
  name: "GuestEditPayload",
  fields: (): GraphQLFieldConfigMap<GuestEditPayload, RequestContext> => ({
    guest: {
      type: GraphQLNonNull(GuestType),
    },
  }),
});

export const GuestEditType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customGuestEditInput }
> = {
  type: GraphQLNonNull(GuestEditPayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(GuestEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<GuestEditPayload> => {
    let guest = await EditGuestAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.guestID),
      {
        name: input.name,
        emailAddress: input.emailAddress,
      },
    );
    return { guest: guest };
  },
};
