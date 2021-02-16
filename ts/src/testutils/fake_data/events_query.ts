import { AssocEdge, Viewer } from "../../core/ent";
import {
  AssocEdgeQueryBase,
  EdgeQuerySource,
} from "../../core/query/assoc_query";
import { FakeUser } from "./fake_user";
import { EdgeType, FakeEvent } from "./internal";

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
      EdgeType.EventToAttendees,
      FakeUser.loaderOptions(),
      AssocEdge,
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
      EdgeType.EventToInvited,
      FakeUser.loaderOptions(),
      AssocEdge,
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
      EdgeType.EventToDeclined,
      FakeUser.loaderOptions(),
      AssocEdge,
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
      EdgeType.EventToMaybe,
      FakeUser.loaderOptions(),
      AssocEdge,
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
      EdgeType.EventToHosts,
      FakeUser.loaderOptions(),
      AssocEdge,
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeEvent>,
  ): EventToHostsQuery {
    return new EventToHostsQuery(viewer, src);
  }
}
