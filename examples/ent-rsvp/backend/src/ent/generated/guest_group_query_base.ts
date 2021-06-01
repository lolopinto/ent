// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  ID,
  Viewer,
  EdgeQuerySource,
  AssocEdgeQueryBase,
  CustomEdgeQueryBase,
  RawCountLoaderFactory,
  AssocEdgeCountLoaderFactory,
  AssocEdgeLoaderFactory,
  IndexLoaderFactory,
} from "@lolopinto/ent";
import {
  EdgeType,
  GuestGroup,
  EventActivity,
  Guest,
  EventActivityToAttendingQuery,
  EventActivityToDeclinedQuery,
  EventActivityToInvitesQuery,
  guestLoader,
  GuestGroupToInvitedEventsEdge,
} from "src/ent/internal";

export const guestGroupToInvitedEventsCountLoaderFactory = new AssocEdgeCountLoaderFactory(
  EdgeType.GuestGroupToInvitedEvents,
);
export const guestGroupToInvitedEventsDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.GuestGroupToInvitedEvents,
  () => GuestGroupToInvitedEventsEdge,
);

export const guestGroupToGuestsCountLoaderFactory = new RawCountLoaderFactory(
  Guest.loaderOptions(),
  "guest_group_id",
);
export const guestGroupToGuestsDataLoaderFactory = new IndexLoaderFactory(
  Guest.loaderOptions(),
  "guest_group_id",
  {
    toPrime: [guestLoader],
  },
);

export class GuestGroupToInvitedEventsQueryBase extends AssocEdgeQueryBase<
  GuestGroup,
  EventActivity,
  GuestGroupToInvitedEventsEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<GuestGroup>) {
    super(
      viewer,
      src,
      guestGroupToInvitedEventsCountLoaderFactory,
      guestGroupToInvitedEventsDataLoaderFactory,
      EventActivity.loaderOptions(),
    );
  }

  static query<T extends GuestGroupToInvitedEventsQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<GuestGroup>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<GuestGroup>,
  ): T {
    return new this(viewer, src);
  }

  queryAttending(): EventActivityToAttendingQuery {
    return EventActivityToAttendingQuery.query(this.viewer, this);
  }

  queryDeclined(): EventActivityToDeclinedQuery {
    return EventActivityToDeclinedQuery.query(this.viewer, this);
  }

  queryInvites(): EventActivityToInvitesQuery {
    return EventActivityToInvitesQuery.query(this.viewer, this);
  }
}

export class GuestGroupToGuestsQueryBase extends CustomEdgeQueryBase<Guest> {
  constructor(viewer: Viewer, src: GuestGroup | ID) {
    super(viewer, {
      src: src,
      countLoaderFactory: guestGroupToGuestsCountLoaderFactory,
      dataLoaderFactory: guestGroupToGuestsDataLoaderFactory,
      options: Guest.loaderOptions(),
    });
  }

  static query<T extends GuestGroupToGuestsQueryBase>(
    this: new (viewer: Viewer, src: GuestGroup | ID) => T,
    viewer: Viewer,
    src: GuestGroup | ID,
  ): T {
    return new this(viewer, src);
  }
}
