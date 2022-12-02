// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

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
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { mustDecodeIDFromGQLID } from "@snowtop/ent/graphql";
import { EventActivity } from "src/ent/";
import EditEventActivityRsvpStatusAction, {
  EditEventActivityRsvpStatusInput,
} from "src/ent/event_activity/actions/edit_event_activity_rsvp_status_action";
import { EventActivityType } from "src/graphql/resolvers/";

interface customEventActivityRsvpStatusEditInput
  extends EditEventActivityRsvpStatusInput {
  id: string;
  guestID: string;
}

interface EventActivityRsvpStatusEditPayload {
  eventActivity: EventActivity;
}

export const EventActivityRsvpStatusInputType = new GraphQLEnumType({
  name: "EventActivityRsvpStatusInput",
  values: {
    ATTENDING: {
      value: "attending",
    },
    DECLINED: {
      value: "declined",
    },
    UNKNOWN: {
      value: "%unknown%",
    },
  },
});

export const EventActivityRsvpStatusEditInputType = new GraphQLInputObjectType({
  name: "EventActivityRsvpStatusEditInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of EventActivity",
      type: new GraphQLNonNull(GraphQLID),
    },
    rsvpStatus: {
      type: new GraphQLNonNull(EventActivityRsvpStatusInputType),
    },
    guestID: {
      type: new GraphQLNonNull(GraphQLID),
    },
    dietaryRestrictions: {
      type: GraphQLString,
    },
  }),
});

export const EventActivityRsvpStatusEditPayloadType = new GraphQLObjectType({
  name: "EventActivityRsvpStatusEditPayload",
  fields: (): GraphQLFieldConfigMap<
    EventActivityRsvpStatusEditPayload,
    RequestContext
  > => ({
    eventActivity: {
      type: new GraphQLNonNull(EventActivityType),
    },
  }),
});

export const EventActivityRsvpStatusEditType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  { [input: string]: customEventActivityRsvpStatusEditInput }
> = {
  type: new GraphQLNonNull(EventActivityRsvpStatusEditPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(EventActivityRsvpStatusEditInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ): Promise<EventActivityRsvpStatusEditPayload> => {
    const eventActivity = await EditEventActivityRsvpStatusAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.id),
      {
        rsvpStatus: input.rsvpStatus,
        guestID: mustDecodeIDFromGQLID(input.guestID),
        dietaryRestrictions: input.dietaryRestrictions,
      },
    );
    return { eventActivity: eventActivity };
  },
};
