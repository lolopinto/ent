import { ID, Viewer } from "../../core/base";
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
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent, FakeUser>) {
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
    src: EdgeQuerySource<FakeEvent, FakeUser>,
  ): EventToAttendeesQuery {
    return new EventToAttendeesQuery(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeEvent.load(this.viewer, id);
  }
}

export class EventToInvitedQuery extends AssocEdgeQueryBase<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent, FakeUser>) {
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
    src: EdgeQuerySource<FakeEvent, FakeUser>,
  ): EventToInvitedQuery {
    return new EventToInvitedQuery(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeEvent.load(this.viewer, id);
  }
}

export class EventToDeclinedQuery extends AssocEdgeQueryBase<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent, FakeUser>) {
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
    src: EdgeQuerySource<FakeEvent, FakeUser>,
  ): EventToDeclinedQuery {
    return new EventToDeclinedQuery(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeEvent.load(this.viewer, id);
  }
}

export class EventToMaybeQuery extends AssocEdgeQueryBase<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent, FakeUser>) {
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
    src: EdgeQuerySource<FakeEvent, FakeUser>,
  ): EventToMaybeQuery {
    return new EventToMaybeQuery(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeEvent.load(this.viewer, id);
  }
}

export class EventToHostsQuery extends AssocEdgeQueryBase<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent, FakeUser>) {
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
    src: EdgeQuerySource<FakeEvent, FakeUser>,
  ): EventToHostsQuery {
    return new EventToHostsQuery(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeEvent.load(this.viewer, id);
  }
}
