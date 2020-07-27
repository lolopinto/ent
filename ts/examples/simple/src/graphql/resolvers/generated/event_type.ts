// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLList,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLResolveInfo,
} from "graphql";
import { ID } from "ent/ent";
import { RequestContext } from "ent/auth/context";
import { GraphQLTime } from "ent/graphql/scalars/time";
import { UserType } from "./user_type";
import Event from "src/ent/event";

interface EventQueryArgs {
  id: ID;
}

export const EventType = new GraphQLObjectType({
  name: "Event",
  fields: (): GraphQLFieldConfigMap<Event, RequestContext> => ({
    creator: {
      type: UserType,
      resolve: (event: Event) => {
        return event.loadCreator();
      },
    },
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
    startTime: {
      type: GraphQLNonNull(GraphQLTime),
    },
    endTime: {
      type: GraphQLTime,
    },
    eventLocation: {
      type: GraphQLNonNull(GraphQLString),
      resolve: (event: Event) => {
        return event.location;
      },
    },
    hosts: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(UserType))),
      resolve: (event: Event) => {
        return event.loadHosts();
      },
    },
    invited: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(UserType))),
      resolve: (event: Event) => {
        return event.loadInvited();
      },
    },
    attending: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(UserType))),
      resolve: (event: Event) => {
        return event.loadAttending();
      },
    },
    declined: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(UserType))),
      resolve: (event: Event) => {
        return event.loadDeclined();
      },
    },
    maybe: {
      type: GraphQLNonNull(GraphQLList(GraphQLNonNull(UserType))),
      resolve: (event: Event) => {
        return event.loadMaybe();
      },
    },
  }),
});

export const EventQuery: GraphQLFieldConfig<
  undefined,
  RequestContext,
  EventQueryArgs
> = {
  type: EventType,
  args: {
    id: {
      description: "",
      type: GraphQLNonNull(GraphQLID),
    },
  },
  resolve: async (
    _source,
    args: EventQueryArgs,
    context: RequestContext,
    _info: GraphQLResolveInfo,
  ) => {
    return Event.load(context.getViewer(), args.id);
  },
};
