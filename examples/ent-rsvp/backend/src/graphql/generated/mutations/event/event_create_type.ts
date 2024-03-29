// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLResolveInfo,
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import { GraphQLTime } from "@snowtop/ent/graphql";
import { Event } from "src/ent/";
import CreateEventAction, {
  EventCreateInput,
} from "src/ent/event/actions/create_event_action";
import { AddressEventActivityCreateInput } from "src/graphql/generated/mutations/event_activity/event_activity_create_type";
import { EventType } from "src/graphql/resolvers/";

interface EventCreatePayload {
  event: Event;
}

export const ActivityEventCreateInput = new GraphQLInputObjectType({
  name: "ActivityEventCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    addressId: {
      type: GraphQLID,
    },
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    startTime: {
      type: new GraphQLNonNull(GraphQLTime),
    },
    endTime: {
      type: GraphQLTime,
    },
    location: {
      type: new GraphQLNonNull(GraphQLString),
    },
    description: {
      type: GraphQLString,
    },
    inviteAllGuests: {
      type: new GraphQLNonNull(GraphQLBoolean),
    },
    address: {
      type: AddressEventActivityCreateInput,
    },
  }),
});

export const EventCreateInputType = new GraphQLInputObjectType({
  name: "EventCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    slug: {
      type: GraphQLString,
    },
    activities: {
      type: new GraphQLList(new GraphQLNonNull(ActivityEventCreateInput)),
    },
  }),
});

export const EventCreatePayloadType = new GraphQLObjectType({
  name: "EventCreatePayload",
  fields: (): GraphQLFieldConfigMap<
    EventCreatePayload,
    RequestContext<Viewer>
  > => ({
    event: {
      type: new GraphQLNonNull(EventType),
    },
  }),
});

export const EventCreateType: GraphQLFieldConfig<
  undefined,
  RequestContext<Viewer>,
  { [input: string]: EventCreateInput }
> = {
  type: new GraphQLNonNull(EventCreatePayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(EventCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<Viewer>,
    _info: GraphQLResolveInfo,
  ): Promise<EventCreatePayload> => {
    const event = await CreateEventAction.create(context.getViewer(), {
      name: input.name,
      slug: input.slug,
      activities: input.activities,
    }).saveX();
    return { event: event };
  },
};
