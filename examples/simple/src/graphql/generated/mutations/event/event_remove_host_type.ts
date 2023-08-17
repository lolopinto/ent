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
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

interface customEventRemoveHostInput {
  id: string;
  hostID: string;
}

interface EventRemoveHostPayload {
  event: Event;
}

export const EventRemoveHostInputType = new GraphQLInputObjectType({
  name: "EventRemoveHostInput",
  fields: (): GraphQLInputFieldConfigMap => ({
    id: {
      description: "id of Event",
      type: new GraphQLNonNull(GraphQLID),
    },
    hostID: {
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
});

export const EventRemoveHostPayloadType = new GraphQLObjectType({
  name: "EventRemoveHostPayload",
  fields: (): GraphQLFieldConfigMap<
    EventRemoveHostPayload,
    RequestContext<ExampleViewerAlias>
  > => ({
    event: {
      type: new GraphQLNonNull(EventType),
    },
  }),
});

export const EventRemoveHostType: GraphQLFieldConfig<
  undefined,
  RequestContext<ExampleViewerAlias>,
  { [input: string]: customEventRemoveHostInput }
> = {
  type: new GraphQLNonNull(EventRemoveHostPayloadType),
  args: {
    input: {
      description: "",
      type: new GraphQLNonNull(EventRemoveHostInputType),
    },
  },
  resolve: async (
    _source,
    { input },
    context: RequestContext<ExampleViewerAlias>,
    _info: GraphQLResolveInfo,
  ): Promise<EventRemoveHostPayload> => {
    const event = await EventRemoveHostAction.saveXFromID(
      context.getViewer(),
      mustDecodeIDFromGQLID(input.id),
      mustDecodeIDFromGQLID(input.hostID),
    );
    return { event };
  },
};
