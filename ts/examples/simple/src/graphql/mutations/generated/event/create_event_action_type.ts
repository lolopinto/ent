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
import { Context } from "src/graphql/context";
import { GraphQLTime } from "ent/graphql/scalars/time";
import { EventType } from "src/graphql/resolvers/generated/event_type.ts";
import { EventCreateInput } from "src/ent/event/actions/create_event_action";
import Event from "src/ent/event";
import CreateEventAction from "src/ent/event/actions/create_event_action";

export const EventCreateInputType = new GraphQLInputObjectType({
  name: "EventCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
    createdAt: {
      type: GraphQLNonNull(GraphQLTime),
    },
    updatedAt: {
      type: GraphQLNonNull(GraphQLTime),
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
    creatorID: {
      type: GraphQLNonNull(GraphQLString),
    },
    startTime: {
      type: GraphQLNonNull(GraphQLTime),
    },
    endTime: {
      type: GraphQLTime,
    },
    eventLocation: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});
interface EventCreateResponse {
  event: Event;
}

export const EventCreateResponseType = new GraphQLObjectType({
  name: "EventCreateResponse",
  fields: (): GraphQLFieldConfigMap<Event, Context> => ({
    event: {
      type: GraphQLNonNull(EventType),
    },
  }),
});

export const EventCreateType: GraphQLFieldConfig<
  undefined,
  Context,
  EventCreateInput
> = {
  type: GraphQLNonNull(EventCreateResponseType),
  args: {
    input: {
      description: "input for action",
      type: GraphQLNonNull(EventCreateInputType),
    },
  },
  resolve: async (
    _source,
    args: EventCreateInput,
    context: Context,
    _info: GraphQLResolveInfo,
  ): Promise<EventCreateResponse> => {
    let event = await CreateEventAction.create(context.viewer, {
      id: args.id,
      name: args.name,
      startTime: args.startTime,
      endTime: args.endTime,
      location: args.location,
    }).saveX();
    return { event: event };
  },
};
