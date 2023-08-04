// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  GraphQLBoolean,
  GraphQLFieldConfigMap,
  GraphQLID,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from "graphql";
import { RequestContext, Viewer, applyPrivacyPolicy } from "@snowtop/ent";
import {
  GraphQLEdgeConnection,
  GraphQLNodeInterface,
  GraphQLTime,
  mustDecodeIDFromGQLID,
  nodeIDEncoder,
} from "@snowtop/ent/graphql";
import {
  EventActivity,
  EventActivityToAttendingQuery,
  EventActivityToDeclinedQuery,
  EventActivityToInvitesQuery,
  Guest,
} from "src/ent/";
import EditEventActivityRsvpStatusAction from "src/ent/event_activity/actions/edit_event_activity_rsvp_status_action";
import EventActivityAddInviteAction from "src/ent/event_activity/actions/event_activity_add_invite_action";
import { EventActivityRsvpStatusInputType } from "src/graphql/generated/mutations/input_enums_type";
import {
  AddressType,
  EventActivityRsvpStatusType,
  EventActivityToAttendingConnectionType,
  EventActivityToDeclinedConnectionType,
  EventActivityToInvitesConnectionType,
  EventType,
} from "src/graphql/resolvers/internal";

class EventActivityCanViewerDo {
  constructor(
    private context: RequestContext<Viewer>,
    private eventActivity: EventActivity,
  ) {}

  async eventActivityAddInvite(args: any): Promise<boolean> {
    const action = EventActivityAddInviteAction.create(
      this.context.getViewer(),
      this.eventActivity,
    );
    return applyPrivacyPolicy(
      this.context.getViewer(),
      action.getPrivacyPolicy(),
      this.eventActivity,
    );
  }

  async eventActivityRsvpStatusEdit(args: any): Promise<boolean> {
    const action = EditEventActivityRsvpStatusAction.create(
      this.context.getViewer(),
      this.eventActivity,
      {
        ...args,
        rsvpStatus: args.rsvpStatus,
        guestID: mustDecodeIDFromGQLID(args.guestID),
        dietaryRestrictions: args.dietaryRestrictions,
      },
    );
    return applyPrivacyPolicy(
      this.context.getViewer(),
      action.getPrivacyPolicy(),
      this.eventActivity,
    );
  }
}

export const EventActivityType = new GraphQLObjectType({
  name: "EventActivity",
  fields: (): GraphQLFieldConfigMap<EventActivity, RequestContext<Viewer>> => ({
    address: {
      type: AddressType,
      resolve: (
        eventActivity: EventActivity,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return eventActivity.loadAddress();
      },
    },
    event: {
      type: EventType,
      resolve: (
        eventActivity: EventActivity,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return eventActivity.loadEvent();
      },
    },
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: nodeIDEncoder,
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
    attending: {
      type: new GraphQLNonNull(EventActivityToAttendingConnectionType()),
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
      resolve: (
        eventActivity: EventActivity,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        return new GraphQLEdgeConnection(
          eventActivity.viewer,
          eventActivity,
          (v, eventActivity: EventActivity) =>
            EventActivityToAttendingQuery.query(v, eventActivity),
          args,
        );
      },
    },
    declined: {
      type: new GraphQLNonNull(EventActivityToDeclinedConnectionType()),
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
      resolve: (
        eventActivity: EventActivity,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        return new GraphQLEdgeConnection(
          eventActivity.viewer,
          eventActivity,
          (v, eventActivity: EventActivity) =>
            EventActivityToDeclinedQuery.query(v, eventActivity),
          args,
        );
      },
    },
    invites: {
      type: new GraphQLNonNull(EventActivityToInvitesConnectionType()),
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
      resolve: (
        eventActivity: EventActivity,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        return new GraphQLEdgeConnection(
          eventActivity.viewer,
          eventActivity,
          (v, eventActivity: EventActivity) =>
            EventActivityToInvitesQuery.query(v, eventActivity),
          args,
        );
      },
    },
    rsvpStatusFor: {
      type: new GraphQLNonNull(EventActivityRsvpStatusType),
      args: {
        id: {
          description: "",
          type: new GraphQLNonNull(GraphQLID),
        },
      },
      resolve: async (
        eventActivity: EventActivity,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        const ent = await Guest.loadX(context.getViewer(), args.id);
        return eventActivity.rsvpStatusFor(ent);
      },
    },
    canViewerDo: {
      type: new GraphQLNonNull(EventActivityCanViewerDoType),
      resolve: (
        eventActivity: EventActivity,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return new EventActivityCanViewerDo(context, eventActivity);
      },
    },
    addressFromOwner: {
      type: AddressType,
      resolve: async (
        eventActivity: EventActivity,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return eventActivity.address();
      },
    },
  }),
  interfaces: () => [GraphQLNodeInterface],
  isTypeOf(obj) {
    return obj instanceof EventActivity;
  },
});

export const EventActivityCanViewerDoType = new GraphQLObjectType({
  name: "EventActivityCanViewerDo",
  fields: (): GraphQLFieldConfigMap<
    EventActivityCanViewerDo,
    RequestContext<Viewer>
  > => ({
    eventActivityAddInvite: {
      type: new GraphQLNonNull(GraphQLBoolean),
      resolve: async (
        eventActivity: EventActivityCanViewerDo,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return eventActivity.eventActivityAddInvite(args);
      },
    },
    eventActivityRsvpStatusEdit: {
      type: new GraphQLNonNull(GraphQLBoolean),
      args: {
        rsvpStatus: {
          description: "",
          type: new GraphQLNonNull(EventActivityRsvpStatusInputType),
        },
        guestID: {
          description: "",
          type: new GraphQLNonNull(GraphQLID),
        },
        dietaryRestrictions: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: async (
        eventActivity: EventActivityCanViewerDo,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        return eventActivity.eventActivityRsvpStatusEdit(args);
      },
    },
  }),
});
