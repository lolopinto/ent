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
import { RequestContext } from "@snowtop/ent";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { EventActivity } from "src/ent/";
import EventActivityAddInviteAction from "src/ent/event_activity/actions/event_activity_add_invite_action";
import { EventActivityType } from "src/graphql/resolvers/";

interface customEventActivityAddInviteInput {
  eventActivityID: string;
  inviteID: string;
}

interface EventActivityAddInvitePayload {
  eventActivity: EventActivity;
}

export const EventActivityAddInviteInputType = new GraphQLInputObjectType({
  name: "EventActivityAddInviteInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    eventActivityID: {
      description: "id of EventActivity",
      type: GraphQLNonNull(GraphQLID),
    },
    inviteID: {
      type: GraphQLNonNull(GraphQLID),
    },
  }),
});

export const EventActivityAddInvitePayloadType = new GraphQLObjectType({
  name: "EventActivityAddInvitePayload",
  fields: (): GraphQLFieldConfigMap<
    EventActivityAddInvitePayload,
    RequestContext
  > => ({
    eventActivity: {
      type: GraphQLNonNull(EventActivityType),
    },
  }),
});

export const EventActivityAddInviteType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customEventActivityAddInviteInput }
> = {
  type: GraphQLNonNull(EventActivityAddInvitePayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(EventActivityAddInviteInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<EventActivityAddInvitePayload> => {
    const eventActivity = await EventActivityAddInviteAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.eventActivityID),
      mustDecodeIDFromGQLID(input.inviteID),
    );
    return { eventActivity: eventActivity };
  },
};
