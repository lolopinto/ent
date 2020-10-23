// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { EdgeType, Event, User } from "src/ent/internal";
import { Viewer, EdgeQuerySource, BaseEdgeQuery } from "@lolopinto/ent";

export class EventToHostsQuery extends BaseEdgeQuery<Event, User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {
    super(viewer, src, EdgeType.EventToHosts, User.loaderOptions());
  }

  static query(viewer: Viewer, src: EdgeQuerySource<Event>): EventToHostsQuery {
    return new EventToHostsQuery(viewer, src);
  }
}

export class EventToInvitedQuery extends BaseEdgeQuery<Event, User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {
    super(viewer, src, EdgeType.EventToInvited, User.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<Event>,
  ): EventToInvitedQuery {
    return new EventToInvitedQuery(viewer, src);
  }
}

export class EventToAttendingQuery extends BaseEdgeQuery<Event, User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {
    super(viewer, src, EdgeType.EventToAttending, User.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<Event>,
  ): EventToAttendingQuery {
    return new EventToAttendingQuery(viewer, src);
  }
}

export class EventToDeclinedQuery extends BaseEdgeQuery<Event, User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {
    super(viewer, src, EdgeType.EventToDeclined, User.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<Event>,
  ): EventToDeclinedQuery {
    return new EventToDeclinedQuery(viewer, src);
  }
}

export class EventToMaybeQuery extends BaseEdgeQuery<Event, User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Event>) {
    super(viewer, src, EdgeType.EventToMaybe, User.loaderOptions());
  }

  static query(viewer: Viewer, src: EdgeQuerySource<Event>): EventToMaybeQuery {
    return new EventToMaybeQuery(viewer, src);
  }
}
