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
import { GraphQLTime, mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { Event } from "../../../../ent";
import EditEventAction, {
  EventEditInput,
} from "../../../../ent/event/actions/edit_event_action";
import { EventType } from "../../../resolvers";

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
      description: "id of Event",
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
    const event = await EditEventAction.saveXFromID(
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
