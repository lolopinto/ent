import { Viewer } from "../../core/base";
import { AssocEdge } from "../../core/ent";
import {
  AssocEdgeQueryBase,
  EdgeQuerySource,
} from "../../core/query/assoc_query";
import { FakeUser } from "./fake_user";
import { EdgeType, FakeEvent } from "./internal";
import { AssocEdgeCountLoaderFactory } from "../../core/loaders/assoc_count_loader";
import { AssocEdgeLoaderFactory } from "../../core/loaders/assoc_edge_loader";

interface EventsDestQuery {
  queryHosts(): EventToHostsQuery;
  queryAttendees(): EventToAttendeesQuery;
  queryInvited(): EventToInvitedQuery;
  queryDeclined(): EventToDeclinedQuery;
  queryMaybe(): EventToMaybeQuery;
}

export class EventToAttendeesQuery extends AssocEdgeQueryBase<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent>) {
    super(
      viewer,
      src,
      new AssocEdgeCountLoaderFactory(EdgeType.EventToAttendees),
      new AssocEdgeLoaderFactory(EdgeType.EventToAttendees, AssocEdge),
      FakeUser.loaderOptions(),
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent>,
  ): EventToAttendeesQuery {
    return new EventToAttendeesQuery(viewer, src);
  }
}

export class EventToInvitedQuery extends AssocEdgeQueryBase<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent>) {
    super(
      viewer,
      src,
      new AssocEdgeCountLoaderFactory(EdgeType.EventToInvited),
      new AssocEdgeLoaderFactory(EdgeType.EventToInvited, AssocEdge),
      FakeUser.loaderOptions(),
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent>,
  ): EventToInvitedQuery {
    return new EventToInvitedQuery(viewer, src);
  }
}

export class EventToDeclinedQuery extends AssocEdgeQueryBase<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent>) {
    super(
      viewer,
      src,
      new AssocEdgeCountLoaderFactory(EdgeType.EventToDeclined),
      new AssocEdgeLoaderFactory(EdgeType.EventToDeclined, AssocEdge),
      FakeUser.loaderOptions(),
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent>,
  ): EventToDeclinedQuery {
    return new EventToDeclinedQuery(viewer, src);
  }
}

export class EventToMaybeQuery extends AssocEdgeQueryBase<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent>) {
    super(
      viewer,
      src,
      new AssocEdgeCountLoaderFactory(EdgeType.EventToMaybe),
      new AssocEdgeLoaderFactory(EdgeType.EventToMaybe, AssocEdge),
      FakeUser.loaderOptions(),
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent>,
  ): EventToMaybeQuery {
    return new EventToMaybeQuery(viewer, src);
  }
}

export class EventToHostsQuery extends AssocEdgeQueryBase<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent>) {
    super(
      viewer,
      src,
      new AssocEdgeCountLoaderFactory(EdgeType.EventToHosts),
      new AssocEdgeLoaderFactory(EdgeType.EventToHosts, AssocEdge),
      FakeUser.loaderOptions(),
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent>,
  ): EventToHostsQuery {
    return new EventToHostsQuery(viewer, src);
  }
}
