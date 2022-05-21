/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  GraphQLEnumType,
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
import EditEventRsvpStatusAction, {
  EditEventRsvpStatusInput,
} from "../../../../ent/event/actions/edit_event_rsvp_status_action";
import { EventType } from "../../../resolvers";

interface customEventRsvpStatusEditInput extends EditEventRsvpStatusInput {
  eventID: string;
  userID: string;
}

interface EventRsvpStatusEditPayload {
  event: Event;
}

export const EventRsvpStatusInputType = new GraphQLEnumType({
  name: "EventRsvpStatusInput",
  values: {
    ATTENDING: {
      value: "attending",
    },
    DECLINED: {
      value: "declined",
    },
    MAYBE: {
      value: "maybe",
    },
  },
});

export const EventRsvpStatusEditInputType = new GraphQLInputObjectType({
  name: "EventRsvpStatusEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    eventID: {
      description: "id of Event",
      type: new GraphQLNonNull(GraphQLID),
    },
    rsvpStatus: {
      type: new GraphQLNonNull(EventRsvpStatusInputType),
    },
    userID: {
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
});

export const EventRsvpStatusEditPayloadType = new GraphQLObjectType({
  name: "EventRsvpStatusEditPayload",
  fields: (): GraphQLFieldConfigMap<
    EventRsvpStatusEditPayload,
    RequestContext
  > => ({
    event: {
      type: new GraphQLNonNull(EventType),
    },
  }),
});

export const EventRsvpStatusEditType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customEventRsvpStatusEditInput }
> = {
  type: new GraphQLNonNull(EventRsvpStatusEditPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(EventRsvpStatusEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<EventRsvpStatusEditPayload> => {
    const event = await EditEventRsvpStatusAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.eventID),
      {
        rsvpStatus: input.rsvpStatus,
        userID: mustDecodeIDFromGQLID(input.userID),
      },
    );
    return { event: event };
  },
};
