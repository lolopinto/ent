// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  CustomEdgeQueryBase,
  ID,
  IndexLoaderFactory,
  RawCountLoaderFactory,
  Viewer,
} from "@snowtop/ent";
import {
  Event,
  EventActivity,
  Guest,
  GuestData,
  GuestGroup,
  eventActivityLoader,
  guestDataLoader,
  guestGroupLoader,
  guestLoader,
} from "src/ent/internal";

export const eventToEventActivitiesCountLoaderFactory =
  new RawCountLoaderFactory({
    ...EventActivity.loaderOptions(),
    groupCol: "event_id",
  });
export const eventToEventActivitiesDataLoaderFactory = new IndexLoaderFactory(
  EventActivity.loaderOptions(),
  "event_id",
  {
    toPrime: [eventActivityLoader],
  },
);
export const eventToGuestDataCountLoaderFactory = new RawCountLoaderFactory({
  ...GuestData.loaderOptions(),
  groupCol: "event_id",
});
export const eventToGuestDataDataLoaderFactory = new IndexLoaderFactory(
  GuestData.loaderOptions(),
  "event_id",
  {
    toPrime: [guestDataLoader],
  },
);
export const eventToGuestGroupsCountLoaderFactory = new RawCountLoaderFactory({
  ...GuestGroup.loaderOptions(),
  groupCol: "event_id",
});
export const eventToGuestGroupsDataLoaderFactory = new IndexLoaderFactory(
  GuestGroup.loaderOptions(),
  "event_id",
  {
    toPrime: [guestGroupLoader],
  },
);
export const eventToGuestsCountLoaderFactory = new RawCountLoaderFactory({
  ...Guest.loaderOptions(),
  groupCol: "event_id",
});
export const eventToGuestsDataLoaderFactory = new IndexLoaderFactory(
  Guest.loaderOptions(),
  "event_id",
  {
    toPrime: [guestLoader],
  },
);

export class EventToEventActivitiesQueryBase extends CustomEdgeQueryBase<EventActivity> {
  constructor(viewer: Viewer, src: Event | ID) {
    super(viewer, {
      src: src,
      countLoaderFactory: eventToEventActivitiesCountLoaderFactory,
      dataLoaderFactory: eventToEventActivitiesDataLoaderFactory,
      options: EventActivity.loaderOptions(),
    });
  }

  static query<T extends EventToEventActivitiesQueryBase>(
    this: new (viewer: Viewer, src: Event | ID) => T,
    viewer: Viewer,
    src: Event | ID,
  ): T {
    return new this(viewer, src);
  }
}

export class EventToGuestDataQueryBase extends CustomEdgeQueryBase<GuestData> {
  constructor(viewer: Viewer, src: Event | ID) {
    super(viewer, {
      src: src,
      countLoaderFactory: eventToGuestDataCountLoaderFactory,
      dataLoaderFactory: eventToGuestDataDataLoaderFactory,
      options: GuestData.loaderOptions(),
    });
  }

  static query<T extends EventToGuestDataQueryBase>(
    this: new (viewer: Viewer, src: Event | ID) => T,
    viewer: Viewer,
    src: Event | ID,
  ): T {
    return new this(viewer, src);
  }
}

export class EventToGuestGroupsQueryBase extends CustomEdgeQueryBase<GuestGroup> {
  constructor(viewer: Viewer, src: Event | ID) {
    super(viewer, {
      src: src,
      countLoaderFactory: eventToGuestGroupsCountLoaderFactory,
      dataLoaderFactory: eventToGuestGroupsDataLoaderFactory,
      options: GuestGroup.loaderOptions(),
    });
  }

  static query<T extends EventToGuestGroupsQueryBase>(
    this: new (viewer: Viewer, src: Event | ID) => T,
    viewer: Viewer,
    src: Event | ID,
  ): T {
    return new this(viewer, src);
  }
}

export class EventToGuestsQueryBase extends CustomEdgeQueryBase<Guest> {
  constructor(viewer: Viewer, src: Event | ID) {
    super(viewer, {
      src: src,
      countLoaderFactory: eventToGuestsCountLoaderFactory,
      dataLoaderFactory: eventToGuestsDataLoaderFactory,
      options: Guest.loaderOptions(),
    });
  }

  static query<T extends EventToGuestsQueryBase>(
    this: new (viewer: Viewer, src: Event | ID) => T,
    viewer: Viewer,
    src: Event | ID,
  ): T {
    return new this(viewer, src);
  }
}
