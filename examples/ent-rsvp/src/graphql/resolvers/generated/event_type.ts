// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLFieldConfigMap,
} from "graphql";
import { RequestContext } from "@lolopinto/ent";
import { GraphQLNodeInterface, nodeIDEncoder } from "@lolopinto/ent/graphql";
import { UserType } from "src/graphql/resolvers/";
import { Event } from "src/ent/";

export const EventType = new GraphQLObjectType({
  name: "Event",
  fields: (): GraphQLFieldConfigMap<Event, RequestContext> => ({
    creator: {
      type: UserType,
      resolve: (event: Event, args: {}) => {
        return event.loadCreator();
      },
    },
    id: {
      type: GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    name: {
      type: GraphQLNonNull(GraphQLString),
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Event;
  },
});
