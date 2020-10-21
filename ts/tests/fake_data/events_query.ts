import { Viewer } from "../../src/core/ent";
import { BaseEdgeQuery, EdgeQuerySource } from "../../src/core/query";
import { FakeUser } from "./fake_user";
import { EdgeType, FakeEvent } from "./internal";

interface EventsDestQuery {
  queryHosts(): EventToHostsQuery;
  queryAttendees(): EventToAttendeesQuery;
  queryInvited(): EventToInvitedQuery;
  queryDeclined(): EventToDeclinedQuery;
  queryMaybe(): EventToMaybeQuery;
}

export class EventToAttendeesQuery extends BaseEdgeQuery<FakeEvent, FakeUser> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent>) {
    super(viewer, src, EdgeType.EventToAttendees, FakeUser.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent>,
  ): EventToAttendeesQuery {
    return new EventToAttendeesQuery(viewer, src);
  }
}

export class EventToInvitedQuery extends BaseEdgeQuery<FakeEvent, FakeUser> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent>) {
    super(viewer, src, EdgeType.EventToInvited, FakeUser.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent>,
  ): EventToInvitedQuery {
    return new EventToInvitedQuery(viewer, src);
  }
}

export class EventToDeclinedQuery extends BaseEdgeQuery<FakeEvent, FakeUser> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent>) {
    super(viewer, src, EdgeType.EventToDeclined, FakeUser.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent>,
  ): EventToDeclinedQuery {
    return new EventToDeclinedQuery(viewer, src);
  }
}

export class EventToMaybeQuery extends BaseEdgeQuery<FakeEvent, FakeUser> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent>) {
    super(viewer, src, EdgeType.EventToMaybe, FakeUser.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent>,
  ): EventToMaybeQuery {
    return new EventToMaybeQuery(viewer, src);
  }
}

export class EventToHostsQuery extends BaseEdgeQuery<FakeEvent, FakeUser> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent>) {
    super(viewer, src, EdgeType.EventToHosts, FakeUser.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent>,
  ): EventToHostsQuery {
    return new EventToHostsQuery(viewer, src);
  }
}
