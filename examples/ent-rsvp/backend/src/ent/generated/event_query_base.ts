// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { CustomEdgeQueryBase, ID, Viewer } from "@snowtop/ent";
import {
  Event,
  EventActivity,
  Guest,
  GuestData,
  GuestGroup,
} from "src/ent/internal";

export class EventToEventActivitiesQueryBase<
  TEnt extends Event = Event,
> extends CustomEdgeQueryBase<TEnt, EventActivity, Viewer> {
  constructor(viewer: Viewer, src: TEnt | ID, sortColumn?: string) {
    super(viewer, {
      src: src,
      groupCol: "event_id",
      loadEntOptions: EventActivity.loaderOptions(),
      name: "EventToEventActivitiesQuery",
      sortColumn,
    });
  }

  static query<
    T extends EventToEventActivitiesQueryBase,
    TEnt extends Event = Event,
  >(
    this: new (
      viewer: Viewer,
      src: TEnt | ID,
    ) => T,
    viewer: Viewer,
    src: TEnt | ID,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(id: ID) {
    return Event.load(this.viewer, id);
  }
}

export class EventToGuestDataQueryBase<
  TEnt extends Event = Event,
> extends CustomEdgeQueryBase<TEnt, GuestData, Viewer> {
  constructor(viewer: Viewer, src: TEnt | ID, sortColumn?: string) {
    super(viewer, {
      src: src,
      groupCol: "event_id",
      loadEntOptions: GuestData.loaderOptions(),
      name: "EventToGuestDataQuery",
      sortColumn,
    });
  }

  static query<T extends EventToGuestDataQueryBase, TEnt extends Event = Event>(
    this: new (
      viewer: Viewer,
      src: TEnt | ID,
    ) => T,
    viewer: Viewer,
    src: TEnt | ID,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(id: ID) {
    return Event.load(this.viewer, id);
  }
}

export class EventToGuestGroupsQueryBase<
  TEnt extends Event = Event,
> extends CustomEdgeQueryBase<TEnt, GuestGroup, Viewer> {
  constructor(viewer: Viewer, src: TEnt | ID, sortColumn?: string) {
    super(viewer, {
      src: src,
      groupCol: "event_id",
      loadEntOptions: GuestGroup.loaderOptions(),
      name: "EventToGuestGroupsQuery",
      sortColumn,
    });
  }

  static query<
    T extends EventToGuestGroupsQueryBase,
    TEnt extends Event = Event,
  >(
    this: new (
      viewer: Viewer,
      src: TEnt | ID,
    ) => T,
    viewer: Viewer,
    src: TEnt | ID,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(id: ID) {
    return Event.load(this.viewer, id);
  }
}

export class EventToGuestsQueryBase<
  TEnt extends Event = Event,
> extends CustomEdgeQueryBase<TEnt, Guest, Viewer> {
  constructor(viewer: Viewer, src: TEnt | ID, sortColumn?: string) {
    super(viewer, {
      src: src,
      groupCol: "event_id",
      loadEntOptions: Guest.loaderOptions(),
      name: "EventToGuestsQuery",
      sortColumn,
    });
  }

  static query<T extends EventToGuestsQueryBase, TEnt extends Event = Event>(
    this: new (
      viewer: Viewer,
      src: TEnt | ID,
    ) => T,
    viewer: Viewer,
    src: TEnt | ID,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(id: ID) {
    return Event.load(this.viewer, id);
  }
}
