// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLResolveInfo,
  GraphQLInputFieldConfigMap,
} from "graphql";
import { RequestContext } from "@lolopinto/ent";
import { mustDecodeIDFromGQLID } from "@lolopinto/ent/graphql";
import { GuestGroup } from "src/ent/";
import { GuestGroupType } from "src/graphql/resolvers/";
import CreateGuestGroupAction, {
  GuestGroupCreateInput,
} from "src/ent/guest_group/actions/create_guest_group_action";

interface customGuestGroupCreateInput extends GuestGroupCreateInput {
  eventID: string;
}

interface GuestGroupCreatePayload {
  guestGroup: GuestGroup;
}

const guestGuestGroupCreateInput = new GraphQLInputObjectType({
  name: "guestGuestGroupCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    name: {
      type: GraphQLNonNull(GraphQLString),
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
      type: GraphQLNonNull(GraphQLString),
    },
    eventID: {
      type: GraphQLNonNull(GraphQLID),
    },
    guests: {
      type: GraphQLList(GraphQLNonNull(guestGuestGroupCreateInput)),
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
      type: GraphQLNonNull(GuestGroupType),
    },
  }),
});

export const GuestGroupCreateType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customGuestGroupCreateInput }
> = {
  type: GraphQLNonNull(GuestGroupCreatePayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(GuestGroupCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<GuestGroupCreatePayload> => {
    let guestGroup = await CreateGuestGroupAction.create(context.getViewer(), {
      invitationName: input.invitationName,
      eventID: mustDecodeIDFromGQLID(input.eventID),
      guests: input.guests,
    }).saveX();
    return { guestGroup: guestGroup };
  },
};
