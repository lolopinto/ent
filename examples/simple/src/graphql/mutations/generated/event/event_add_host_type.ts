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
import { RequestContext } from "@lolopinto/ent";
import { mustDecodeIDFromGQLID } from "@lolopinto/ent/graphql";
import { Event } from "src/ent/";
import EventAddHostAction from "src/ent/event/actions/event_add_host_action";
import { EventType } from "src/graphql/resolvers/";

interface customEventAddHostInput {
  eventID: string;
  hostID: string;
}

interface EventAddHostPayload {
  event: Event;
}

export const EventAddHostInputType = new GraphQLInputObjectType({
  name: "EventAddHostInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    eventID: {
      type: GraphQLNonNull(GraphQLID),
    },
    hostID: {
      type: GraphQLNonNull(GraphQLID),
    },
  }),
});

export const EventAddHostPayloadType = new GraphQLObjectType({
  name: "EventAddHostPayload",
  fields: (): GraphQLFieldConfigMap<EventAddHostPayload, RequestContext> => ({
    event: {
      type: GraphQLNonNull(EventType),
    },
  }),
});

export const EventAddHostType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customEventAddHostInput }
> = {
  type: GraphQLNonNull(EventAddHostPayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(EventAddHostInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<EventAddHostPayload> => {
    let event = await EventAddHostAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.eventID),
      mustDecodeIDFromGQLID(input.hostID),
    );
    return { event: event };
  },
};
