import { AssocEdge, Viewer } from "../../src/core/ent";
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

export class EventToAttendeesQuery extends BaseEdgeQuery<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent, AssocEdge>) {
    super(
      viewer,
      src,
      EdgeType.EventToAttendees,
      FakeUser.loaderOptions(),
      AssocEdge,
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent, AssocEdge>,
  ): EventToAttendeesQuery {
    return new EventToAttendeesQuery(viewer, src);
  }
}

export class EventToInvitedQuery extends BaseEdgeQuery<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent, AssocEdge>) {
    super(
      viewer,
      src,
      EdgeType.EventToInvited,
      FakeUser.loaderOptions(),
      AssocEdge,
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent, AssocEdge>,
  ): EventToInvitedQuery {
    return new EventToInvitedQuery(viewer, src);
  }
}

export class EventToDeclinedQuery extends BaseEdgeQuery<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent, AssocEdge>) {
    super(
      viewer,
      src,
      EdgeType.EventToDeclined,
      FakeUser.loaderOptions(),
      AssocEdge,
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent, AssocEdge>,
  ): EventToDeclinedQuery {
    return new EventToDeclinedQuery(viewer, src);
  }
}

export class EventToMaybeQuery extends BaseEdgeQuery<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent, AssocEdge>) {
    super(
      viewer,
      src,
      EdgeType.EventToMaybe,
      FakeUser.loaderOptions(),
      AssocEdge,
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent, AssocEdge>,
  ): EventToMaybeQuery {
    return new EventToMaybeQuery(viewer, src);
  }
}

export class EventToHostsQuery extends BaseEdgeQuery<
  FakeEvent,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeEvent, AssocEdge>) {
    super(
      viewer,
      src,
      EdgeType.EventToHosts,
      FakeUser.loaderOptions(),
      AssocEdge,
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent, AssocEdge>,
  ): EventToHostsQuery {
    return new EventToHostsQuery(viewer, src);
  }
}
