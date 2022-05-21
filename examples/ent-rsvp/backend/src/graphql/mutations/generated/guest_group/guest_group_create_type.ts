// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { GuestGroup } from "src/ent/";
import CreateGuestGroupAction, {
  GuestGroupCreateInput,
} from "src/ent/guest_group/actions/create_guest_group_action";
import { GuestGroupType } from "src/graphql/resolvers/";

interface customGuestGroupCreateInput extends GuestGroupCreateInput {
  eventID: string;
}

interface GuestGroupCreatePayload {
  guestGroup: GuestGroup;
}

export const GuestGuestGroupCreateInput = new GraphQLInputObjectType({
  name: "GuestGuestGroupCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    emailAddress: {
      type: GraphQLString,
    },
    title: {
      type: GraphQLString,
    },
  }),
});

export const GuestGroupCreateInputType = new GraphQLInputObjectType({
  name: "GuestGroupCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    invitationName: {
      type: new GraphQLNonNull(GraphQLString),
    },
    eventID: {
      type: new GraphQLNonNull(GraphQLID),
    },
    guests: {
      type: new GraphQLList(new GraphQLNonNull(GuestGuestGroupCreateInput)),
    },
  }),
});

export const GuestGroupCreatePayloadType = new GraphQLObjectType({
  name: "GuestGroupCreatePayload",
  fields: (): GraphQLFieldConfigMap<
    GuestGroupCreatePayload,
    RequestContext
  > => ({
    guestGroup: {
      type: new GraphQLNonNull(GuestGroupType),
    },
  }),
});

export const GuestGroupCreateType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customGuestGroupCreateInput }
> = {
  type: new GraphQLNonNull(GuestGroupCreatePayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(GuestGroupCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<GuestGroupCreatePayload> => {
    const guestGroup = await CreateGuestGroupAction.create(
      context.getViewer(),
      {
        invitationName: input.invitationName,
        eventID: mustDecodeIDFromGQLID(input.eventID),
        guests: input.guests,
      },
    ).saveX();
    return { guestGroup: guestGroup };
  },
};
