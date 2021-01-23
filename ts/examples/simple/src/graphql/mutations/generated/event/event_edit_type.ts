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
import { GraphQLTime, mustDecodeIDFromGQLID } from "@lolopinto/ent/graphql";
import { Event } from "src/ent/";
import { EventType } from "src/graphql/resolvers/";
import EditEventAction, {
  EventEditInput,
} from "src/ent/event/actions/edit_event_action";

interface customEventEditInput extends EventEditInput {
  eventID: string;
  creatorID: string;
}

interface EventEditPayload {
  event: Event;
}

export const EventEditInputType = new GraphQLInputObjectType({
  name: "EventEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    eventID: {
      type: GraphQLNonNull(GraphQLID),
    },
    name: {
      type: GraphQLString,
    },
    creatorID: {
      type: GraphQLID,
    },
    startTime: {
      type: GraphQLTime,
    },
    endTime: {
      type: GraphQLTime,
    },
    eventLocation: {
      type: GraphQLString,
    },
  }),
});

export const EventEditPayloadType = new GraphQLObjectType({
  name: "EventEditPayload",
  fields: (): GraphQLFieldConfigMap<EventEditPayload, RequestContext> => ({
    event: {
      type: GraphQLNonNull(EventType),
    },
  }),
});

export const EventEditType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customEventEditInput }
> = {
  type: GraphQLNonNull(EventEditPayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(EventEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<EventEditPayload> => {
    let event = await EditEventAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.eventID),
      {
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location,
      },
    );
    return { event: event };
  },
};
