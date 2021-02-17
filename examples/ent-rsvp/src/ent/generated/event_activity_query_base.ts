// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  EdgeType,
  EventActivity,
  Guest,
  GuestGroup,
  GuestToAttendingEventsQuery,
  GuestToDeclinedEventsQuery,
  GuestGroupToInvitedEventsQuery,
  EventActivityToAttendingEdge,
  EventActivityToDeclinedEdge,
  EventActivityToInvitesEdge,
} from "src/ent/internal";
import { Viewer, EdgeQuerySource, AssocEdgeQueryBase } from "@lolopinto/ent";

export class EventActivityToAttendingQueryBase extends AssocEdgeQueryBase<
  EventActivity,
  Guest,
  EventActivityToAttendingEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<EventActivity>) {
    super(
      viewer,
      src,
      EdgeType.EventActivityToAttending,
      Guest.loaderOptions(),
      EventActivityToAttendingEdge,
    );
  }

  static query<T extends EventActivityToAttendingQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<EventActivity>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<EventActivity>,
  ): T {
    return new this(viewer, src);
  }

  queryGuestToAttendingEvents(): GuestToAttendingEventsQuery {
    return GuestToAttendingEventsQuery.query(this.viewer, this);
  }

  queryGuestToDeclinedEvents(): GuestToDeclinedEventsQuery {
    return GuestToDeclinedEventsQuery.query(this.viewer, this);
  }
}

export class EventActivityToDeclinedQueryBase extends AssocEdgeQueryBase<
  EventActivity,
  Guest,
  EventActivityToDeclinedEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<EventActivity>) {
    super(
      viewer,
      src,
      EdgeType.EventActivityToDeclined,
      Guest.loaderOptions(),
      EventActivityToDeclinedEdge,
    );
  }

  static query<T extends EventActivityToDeclinedQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<EventActivity>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<EventActivity>,
  ): T {
    return new this(viewer, src);
  }

  queryGuestToAttendingEvents(): GuestToAttendingEventsQuery {
    return GuestToAttendingEventsQuery.query(this.viewer, this);
  }

  queryGuestToDeclinedEvents(): GuestToDeclinedEventsQuery {
    return GuestToDeclinedEventsQuery.query(this.viewer, this);
  }
}

export class EventActivityToInvitesQueryBase extends AssocEdgeQueryBase<
  EventActivity,
  GuestGroup,
  EventActivityToInvitesEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<EventActivity>) {
    super(
      viewer,
      src,
      EdgeType.EventActivityToInvites,
      GuestGroup.loaderOptions(),
      EventActivityToInvitesEdge,
    );
  }

  static query<T extends EventActivityToInvitesQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<EventActivity>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<EventActivity>,
  ): T {
    return new this(viewer, src);
  }

  queryGuestGroupToInvitedEvents(): GuestGroupToInvitedEventsQuery {
    return GuestGroupToInvitedEventsQuery.query(this.viewer, this);
  }
}
