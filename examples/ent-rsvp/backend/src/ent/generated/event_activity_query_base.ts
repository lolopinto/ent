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
import {
  Viewer,
  EdgeQuerySource,
  AssocEdgeQueryBase,
  AssocEdgeCountLoaderFactory,
  AssocEdgeLoaderFactory,
} from "@lolopinto/ent";

export const eventActivityToAttendingCountLoaderFactory = new AssocEdgeCountLoaderFactory(
  EdgeType.EventActivityToAttending,
);
export const eventActivityToAttendingDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.EventActivityToAttending,
  () => EventActivityToAttendingEdge,
);

export const eventActivityToDeclinedCountLoaderFactory = new AssocEdgeCountLoaderFactory(
  EdgeType.EventActivityToDeclined,
);
export const eventActivityToDeclinedDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.EventActivityToDeclined,
  () => EventActivityToDeclinedEdge,
);

export const eventActivityToInvitesCountLoaderFactory = new AssocEdgeCountLoaderFactory(
  EdgeType.EventActivityToInvites,
);
export const eventActivityToInvitesDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.EventActivityToInvites,
  () => EventActivityToInvitesEdge,
);

export class EventActivityToAttendingQueryBase extends AssocEdgeQueryBase<
  EventActivity,
  Guest,
  EventActivityToAttendingEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<EventActivity>) {
    super(
      viewer,
      src,
      eventActivityToAttendingCountLoaderFactory,
      eventActivityToAttendingDataLoaderFactory,
      Guest.loaderOptions(),
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
      eventActivityToDeclinedCountLoaderFactory,
      eventActivityToDeclinedDataLoaderFactory,
      Guest.loaderOptions(),
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
      eventActivityToInvitesCountLoaderFactory,
      eventActivityToInvitesDataLoaderFactory,
      GuestGroup.loaderOptions(),
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
