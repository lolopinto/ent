import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLFieldConfig,
  GraphQLResolveInfo,
} from "graphql";
import { userType } from "./user_type";
import Event from "src/ent/event";
import { timeType } from "./time";
import { ID } from "ent/ent";
import { Context } from "src/graphql/context";

export const eventType = new GraphQLObjectType({
  name: "Event",
  description: "Event",
  // TODO move this to interface...
  fields: () => ({
    id: {
      type: GraphQLNonNull(GraphQLID),
      description: "id",
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
      description: "name",
    },
    location: {
      type: GraphQLNonNull(GraphQLString),
      description: "location",
    },
    startTime: {
      type: GraphQLNonNull(timeType),
      description: "startTime",
    },
    endTime: {
      type: timeType,
      description: "endTime",
    },
    // TODO start and end time
    creator: {
      type: userType,
      description: "creator",
      resolve: (event: Event) => {
        return event.loadCreator();
      },
    },
  }),
});

interface eventQueryArgs {
  id: ID;
}

export const eventQuery: GraphQLFieldConfig<
  undefined,
  Context,
  eventQueryArgs
> = {
  type: eventType,
  args: {
    id: {
      description: "id",
      type: GraphQLID,
    },
  },
  resolve: async (_source, args, context, _info: GraphQLResolveInfo) => {
    console.log("sss");
    return Event.load(context.viewer, args.id);
  },
};
