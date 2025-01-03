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
    private ent: EventActivity,
  ) {}

  async eventActivityAddInvite(args: any): Promise<boolean> {
    const action = EventActivityAddInviteAction.create(
      this.context.getViewer(),
      this.ent,
      {
        ...args,
        test: args.test,
      },
    );
    return applyPrivacyPolicy(
      this.context.getViewer(),
      action.getPrivacyPolicy(),
      this.ent,
    );
  }

  async eventActivityRsvpStatusEdit(args: any): Promise<boolean> {
    const action = EditEventActivityRsvpStatusAction.create(
      this.context.getViewer(),
      this.ent,
      {
        ...args,
        rsvpStatus: args.rsvpStatus,
        guestId: mustDecodeIDFromGQLID(args.guestId.toString()),
        dietaryRestrictions: args.dietaryRestrictions,
      },
    );
    return applyPrivacyPolicy(
      this.context.getViewer(),
      action.getPrivacyPolicy(),
      this.ent,
    );
  }
}

export const EventActivityType = new GraphQLObjectType({
  name: "EventActivity",
  fields: (): GraphQLFieldConfigMap<EventActivity, RequestContext<Viewer>> => ({
    address: {
      type: AddressType,
      resolve: (
        obj: EventActivity,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return obj.loadAddress();
      },
    },
    event: {
      type: EventType,
      resolve: (
        obj: EventActivity,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return obj.loadEvent();
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
        obj: EventActivity,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: EventActivity) =>
            EventActivityToAttendingQuery.query(v, obj),
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
        obj: EventActivity,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: EventActivity) => EventActivityToDeclinedQuery.query(v, obj),
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
        obj: EventActivity,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        return new GraphQLEdgeConnection(
          obj.viewer,
          obj,
          (v, obj: EventActivity) => EventActivityToInvitesQuery.query(v, obj),
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
        obj: EventActivity,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        const ent = await Guest.loadX(context.getViewer(), args.id);
        return obj.rsvpStatusFor(ent);
      },
    },
    canViewerDo: {
      type: new GraphQLNonNull(EventActivityCanViewerDoType),
      resolve: (
        obj: EventActivity,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return new EventActivityCanViewerDo(context, obj);
      },
    },
    addressFromOwner: {
      type: AddressType,
      resolve: async (
        obj: EventActivity,
        args: {},
        context: RequestContext<Viewer>,
      ) => {
        return obj.address();
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
      args: {
        test: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: async (
        obj: EventActivityCanViewerDo,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        return obj.eventActivityAddInvite(args);
      },
    },
    eventActivityRsvpStatusEdit: {
      type: new GraphQLNonNull(GraphQLBoolean),
      args: {
        rsvpStatus: {
          description: "",
          type: new GraphQLNonNull(EventActivityRsvpStatusInputType),
        },
        guestId: {
          description: "",
          type: new GraphQLNonNull(GraphQLID),
        },
        dietaryRestrictions: {
          description: "",
          type: GraphQLString,
        },
      },
      resolve: async (
        obj: EventActivityCanViewerDo,
        args: any,
        context: RequestContext<Viewer>,
      ) => {
        return obj.eventActivityRsvpStatusEdit(args);
      },
    },
  }),
});
