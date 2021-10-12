// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLBoolean,
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
import { GraphQLTime, mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { EventActivity } from "src/ent/";
import EditEventActivityAction, {
  EventActivityEditInput,
} from "src/ent/event_activity/actions/edit_event_activity_action";
import { EventActivityType } from "src/graphql/resolvers/";

interface customEventActivityEditInput extends EventActivityEditInput {
  eventActivityID: string;
  eventID: string;
}

interface EventActivityEditPayload {
  eventActivity: EventActivity;
}

export const EventActivityEditInputType = new GraphQLInputObjectType({
  name: "EventActivityEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    eventActivityID: {
      type: GraphQLNonNull(GraphQLID),
    },
    name: {
      type: GraphQLString,
    },
    eventID: {
      type: GraphQLID,
    },
    startTime: {
      type: GraphQLTime,
    },
    endTime: {
      type: GraphQLTime,
    },
    location: {
      type: GraphQLString,
    },
    description: {
      type: GraphQLString,
    },
    inviteAllGuests: {
      type: GraphQLBoolean,
    },
  }),
});

export const EventActivityEditPayloadType = new GraphQLObjectType({
  name: "EventActivityEditPayload",
  fields: (): GraphQLFieldConfigMap<
    EventActivityEditPayload,
    RequestContext
  > => ({
    eventActivity: {
      type: GraphQLNonNull(EventActivityType),
    },
  }),
});

export const EventActivityEditType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customEventActivityEditInput }
> = {
  type: GraphQLNonNull(EventActivityEditPayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(EventActivityEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<EventActivityEditPayload> => {
    const eventActivity = await EditEventActivityAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.eventActivityID),
      {
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location,
        description: input.description,
        inviteAllGuests: input.inviteAllGuests,
      },
    );
    return { eventActivity: eventActivity };
  },
};
