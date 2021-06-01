// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLObjectType,
  GraphQLID,
  GraphQLString,
  GraphQLNonNull,
  GraphQLInt,
  GraphQLFieldConfigMap,
} from "graphql";
import { RequestContext } from "@lolopinto/ent";
import {
  GraphQLNodeInterface,
  nodeIDEncoder,
  GraphQLEdgeConnection,
} from "@lolopinto/ent/graphql";
import {
  Event,
  EventToEventActivitiesQuery,
  EventToGuestGroupsQuery,
  EventToGuestsQuery,
} from "src/ent/";
import {
  UserType,
  EventToEventActivitiesConnectionType,
  EventToGuestGroupsConnectionType,
  EventToGuestsConnectionType,
} from "src/graphql/resolvers/internal";

export const EventType = new GraphQLObjectType({
  name: "Event",
  fields: (): GraphQLFieldConfigMap<Event, RequestContext> => ({
    creator: {
      type: UserType,
      resolve: (event: Event, args: {}, context: RequestContext) => {
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
    slug: {
      type: GraphQLString,
    },
    eventActivities: {
      type: GraphQLNonNull(EventToEventActivitiesConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (event: Event, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          event.viewer,
          event,
          (v, event: Event) => EventToEventActivitiesQuery.query(v, event),
          args,
        );
      },
    },
    guestGroups: {
      type: GraphQLNonNull(EventToGuestGroupsConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (event: Event, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          event.viewer,
          event,
          (v, event: Event) => EventToGuestGroupsQuery.query(v, event),
          args,
        );
      },
    },
    guests: {
      type: GraphQLNonNull(EventToGuestsConnectionType()),
      args: {
        first: {
          description: "",
          type: GraphQLInt,
        },
        after: {
          description: "",
          type: GraphQLString,
        },
        last: {
          description: "",
          type: GraphQLInt,
        },
        before: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: (event: Event, args: {}, context: RequestContext) => {
        return new GraphQLEdgeConnection(
          event.viewer,
          event,
          (v, event: Event) => EventToGuestsQuery.query(v, event),
          args,
        );
      },
    },
  }),
  interfaces: [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Event;
  },
});
