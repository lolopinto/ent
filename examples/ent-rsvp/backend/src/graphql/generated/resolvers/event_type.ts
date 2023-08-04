// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer } from "@snowtop/ent";
import {
  GraphQLEdgeConnection,
  GraphQLNodeInterface,
  nodeIDEncoder,
} from "@snowtop/ent/graphql";
import {
  Event,
  EventToEventActivitiesQuery,
  EventToGuestGroupsQuery,
  EventToGuestsQuery,
} from "src/ent/";
import {
  EventToEventActivitiesConnectionType,
  EventToGuestGroupsConnectionType,
  EventToGuestsConnectionType,
  UserType,
} from "src/graphql/resolvers/internal";

export const EventType = new GraphQLObjectType({
  name: "Event",
  fields: (): GraphQLFieldConfigMap<Event, RequestContext<Viewer>> => ({
    creator: {
      type: UserType,
      resolve: (event: Event, args: {}, context: RequestContext<Viewer>) => {
        return event.loadCreator();
      },
    },
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
    },
    name: {
      type: new GraphQLNonNull(GraphQLString),
    },
    slug: {
      type: GraphQLString,
    },
    eventActivities: {
      type: new GraphQLNonNull(EventToEventActivitiesConnectionType()),
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
      resolve: (event: Event, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          event.viewer,
          event,
          (v, event: Event) => EventToEventActivitiesQuery.query(v, event),
          args,
        );
      },
    },
    guestGroups: {
      type: new GraphQLNonNull(EventToGuestGroupsConnectionType()),
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
      resolve: (event: Event, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          event.viewer,
          event,
          (v, event: Event) => EventToGuestGroupsQuery.query(v, event),
          args,
        );
      },
    },
    guests: {
      type: new GraphQLNonNull(EventToGuestsConnectionType()),
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
      resolve: (event: Event, args: any, context: RequestContext<Viewer>) => {
        return new GraphQLEdgeConnection(
          event.viewer,
          event,
          (v, event: Event) => EventToGuestsQuery.query(v, event),
          args,
        );
      },
    },
  }),
  interfaces: () => [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof Event;
  },
});
