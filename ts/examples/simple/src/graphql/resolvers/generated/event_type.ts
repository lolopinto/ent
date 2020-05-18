// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLResolveInfo,
} from "graphql";
import { ID } from "ent/ent";
import { Context } from "src/graphql/context";
import { GraphQLTime } from "ent/graphql/scalars/time";
import Event from "src/ent/event";

export const EventType = new GraphQLObjectType({
  name: "Event",
  fields: (): GraphQLFieldConfigMap<Event, Context> => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
    creatorID: {
      type: GraphQLNonNull(GraphQLString),
    },
    startTime: {
      type: GraphQLNonNull(GraphQLTime),
    },
    endTime: {
      type: GraphQLTime,
    },
    location: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
});

interface EventQueryArgs {
  id: ID;
}

export const EventQuery: GraphQLFieldConfig<
  undefined,
  Context,
  EventQueryArgs
> = {
  type: EventType,
  args: {
    id: {
      description: "id",
      type: GraphQLID,
    },
  },
  resolve: async (
    _source,
    args: EventQueryArgs,
    context: Context,
    _info: GraphQLResolveInfo,
  ) => {
    return Event.load(context.viewer, args.id);
  },
};
