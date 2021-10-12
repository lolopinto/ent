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
} from "graphql";
import { RequestContext } from "@snowtop/ent";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { Event } from "../../../../ent";
import EventRemoveHostAction from "../../../../ent/event/actions/event_remove_host_action";
import { EventType } from "../../../resolvers";

interface customEventRemoveHostInput {
  eventID: string;
  hostID: string;
}

interface EventRemoveHostPayload {
  event: Event;
}

export const EventRemoveHostInputType = new GraphQLInputObjectType({
  name: "EventRemoveHostInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    eventID: {
      type: GraphQLNonNull(GraphQLID),
    },
    hostID: {
      type: GraphQLNonNull(GraphQLID),
    },
  }),
});

export const EventRemoveHostPayloadType = new GraphQLObjectType({
  name: "EventRemoveHostPayload",
  fields: (): GraphQLFieldConfigMap<
    EventRemoveHostPayload,
    RequestContext
  > => ({
    event: {
      type: GraphQLNonNull(EventType),
    },
  }),
});

export const EventRemoveHostType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customEventRemoveHostInput }
> = {
  type: GraphQLNonNull(EventRemoveHostPayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(EventRemoveHostInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<EventRemoveHostPayload> => {
    const event = await EventRemoveHostAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.eventID),
      mustDecodeIDFromGQLID(input.hostID),
    );
    return { event: event };
  },
};
