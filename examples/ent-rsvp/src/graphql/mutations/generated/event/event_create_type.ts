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
import { mustDecodeIDFromGQLID } from "@lolopinto/ent/graphql";
import { Event } from "src/ent/";
import { EventType } from "src/graphql/resolvers/";
import CreateEventAction, {
  EventCreateInput,
} from "src/ent/event/actions/create_event_action";

interface customEventCreateInput extends EventCreateInput {
  creatorID: string;
}

interface EventCreatePayload {
  event: Event;
}

const addressEventCreateInput = new GraphQLInputObjectType({
  name: "addressEventCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    street: {
      type: GraphQLNonNull(GraphQLString),
    },
    city: {
      type: GraphQLNonNull(GraphQLString),
    },
    state: {
      type: GraphQLNonNull(GraphQLString),
    },
    zipCode: {
      type: GraphQLNonNull(GraphQLString),
    },
    apartment: {
      type: GraphQLString,
    },
  }),
});

export const EventCreateInputType = new GraphQLInputObjectType({
  name: "EventCreateInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
    creatorID: {
      type: GraphQLNonNull(GraphQLID),
    },
    address: {
      type: addressEventCreateInput,
    },
  }),
});

export const EventCreatePayloadType = new GraphQLObjectType({
  name: "EventCreatePayload",
  fields: (): GraphQLFieldConfigMap<EventCreatePayload, RequestContext> => ({
    event: {
      type: GraphQLNonNull(EventType),
    },
  }),
});

export const EventCreateType: GraphQLFieldConfig<
  undefined,
  RequestContext,
  { [input: string]: customEventCreateInput }
> = {
  type: GraphQLNonNull(EventCreatePayloadType),
  args: {
    input: {
      description: "",
      type: GraphQLNonNull(EventCreateInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ): Promise<EventCreatePayload> => {
    let event = await CreateEventAction.create(context.getViewer(), {
      name: input.name,
      creatorID: mustDecodeIDFromGQLID(input.creatorID),
      address: input.address,
    }).saveX();
    return { event: event };
  },
};
