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
import EditEventRsvpStatusAction, {
  EditEventRsvpStatusInput,
} from "../../../../ent/event/actions/edit_event_rsvp_status_action";
import { EventRsvpStatusInputType } from "../input_enums_type";
import { EventType } from "../../../resolvers";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

interface customEventRsvpStatusEditInput extends EditEventRsvpStatusInput {
  id: string;
  userId: string;
}

interface EventRsvpStatusEditPayload {
  event: Event;
}

export const EventRsvpStatusEditInputType = new GraphQLInputObjectType({
  name: "EventRsvpStatusEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Event",
      type: new GraphQLNonNull(GraphQLID),
    },
    rsvpStatus: {
      type: new GraphQLNonNull(EventRsvpStatusInputType),
    },
    userId: {
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
});

export const EventRsvpStatusEditPayloadType = new GraphQLObjectType({
  name: "EventRsvpStatusEditPayload",
  fields: (): GraphQLFieldConfigMap<
    EventRsvpStatusEditPayload,
    RequestContext<ExampleViewerAlias>
  > => ({
    event: {
      type: new GraphQLNonNull(EventType),
    },
  }),
});

export const EventRsvpStatusEditType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
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
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<EventRsvpStatusEditPayload> => {
    const event = await EditEventRsvpStatusAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.id),
      {
        rsvpStatus: input.rsvpStatus,
        userId: mustDecodeIDFromGQLID(input.userId.toString()),
      },
    );
    return { event };
  },
};
