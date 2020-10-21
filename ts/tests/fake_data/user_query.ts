import { Ent, Viewer } from "../../src/core/ent";
import { BaseEdgeQuery, EdgeQuerySource } from "../../src/core/query";

import {
  EdgeType,
  FakeUser,
  FakeEvent,
  FakeContact,
  EventToAttendeesQuery,
  EventToDeclinedQuery,
  EventToHostsQuery,
  EventToInvitedQuery,
  EventToMaybeQuery,
} from "./internal";

// eliminating base classes because of circular dependency issues
// can't use it like this when referenced this way
// export class BaseUserDestQuery<TSource extends Ent> extends BaseEdgeQuery<
//   TSource,
//   FakeUser
// > {
//   constructor(viewer: Viewer, src: EdgeQuerySource<TSource>, edgeType: string) {
//     super(viewer, src, edgeType, FakeUser.loaderOptions());
//   }
// }

export class UserToContactsQuery extends BaseEdgeQuery<FakeUser, FakeContact> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(viewer, src, EdgeType.UserToContacts, FakeContact.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser>,
  ): UserToContactsQuery {
    return new UserToContactsQuery(viewer, src);
  }
}

export class UserToFriendsQuery extends BaseEdgeQuery<FakeUser, FakeUser> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(viewer, src, EdgeType.UserToFriends, FakeUser.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser>,
  ): UserToFriendsQuery {
    return new UserToFriendsQuery(viewer, src);
  }

  queryContacts(): UserToContactsQuery {
    return UserToContactsQuery.query(this.viewer, this);
  }

  queryFriends(): UserToFriendsQuery {
    return UserToFriendsQuery.query(this.viewer, this);
  }

  queryHostedEvents(): UserToHostedEventsQuery {
    return UserToHostedEventsQuery.query(this.viewer, this);
  }

  queryEventsAttending(): UserToEventsAttendingQuery {
    return UserToEventsAttendingQuery.query(this.viewer, this);
  }
}

export class UserToEventsAttendingQuery extends BaseEdgeQuery<
  FakeUser,
  FakeEvent
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(
      viewer,
      src,
      EdgeType.UserToEventsAttending,
      FakeEvent.loaderOptions(),
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser>,
  ): UserToEventsAttendingQuery {
    return new UserToEventsAttendingQuery(viewer, src);
  }

  queryHosts(): EventToHostsQuery {
    return EventToHostsQuery.query(this.viewer, this);
  }
  queryAttendees(): EventToAttendeesQuery {
    return EventToAttendeesQuery.query(this.viewer, this);
  }
  queryInvited(): EventToInvitedQuery {
    return EventToInvitedQuery.query(this.viewer, this);
  }
  queryDeclined(): EventToDeclinedQuery {
    return EventToDeclinedQuery.query(this.viewer, this);
  }
  queryMaybe(): EventToMaybeQuery {
    return EventToDeclinedQuery.query(this.viewer, this);
  }
}

export class UserToHostedEventsQuery extends BaseEdgeQuery<
  FakeUser,
  FakeEvent
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(viewer, src, EdgeType.UserToHostedEvents, FakeEvent.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser>,
  ): UserToHostedEventsQuery {
    return new UserToHostedEventsQuery(viewer, src);
  }

  queryHosts(): EventToHostsQuery {
    return EventToHostsQuery.query(this.viewer, this);
  }
  queryAttendees(): EventToAttendeesQuery {
    return EventToAttendeesQuery.query(this.viewer, this);
  }
  queryInvited(): EventToInvitedQuery {
    return EventToInvitedQuery.query(this.viewer, this);
  }
  queryDeclined(): EventToDeclinedQuery {
    return EventToDeclinedQuery.query(this.viewer, this);
  }
  queryMaybe(): EventToMaybeQuery {
    return EventToDeclinedQuery.query(this.viewer, this);
  }
}
