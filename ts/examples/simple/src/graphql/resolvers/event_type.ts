import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
} from "graphql";
import { userType } from "./user_type";
import Event from "src/ent/event";
import { timeType } from "./time";

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
