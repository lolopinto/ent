import { CustomEdgeQueryBase } from "../../core/query/custom_query";
import { AssocEdge, Ent, ID, Viewer } from "../../core/ent";
import {
  AssocEdgeQueryBase,
  EdgeQuerySource,
} from "../../core/query/assoc_query";
import * as clause from "../../core/clause";
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

export class UserToContactsQuery extends AssocEdgeQueryBase<
  FakeUser,
  FakeContact,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(
      viewer,
      src,
      EdgeType.UserToContacts,
      FakeContact.loaderOptions(),
      AssocEdge,
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser>,
  ): UserToContactsQuery {
    return new UserToContactsQuery(viewer, src);
  }
}

function getID(src: Ent | ID) {
  if (typeof src === "object") {
    return src.id;
  } else {
    return src;
  }
}

export class UserToContactsFkeyQuery extends CustomEdgeQueryBase<FakeContact> {
  constructor(viewer: Viewer, src: ID | FakeUser) {
    super(
      viewer,
      src,
      FakeContact.loaderOptions(),
      clause.Eq("user_id", getID(src)),
    );
  }

  static query(viewer: Viewer, src: FakeUser | ID): UserToContactsFkeyQuery {
    return new UserToContactsFkeyQuery(viewer, src);
  }
}

export class UserToFriendsQuery extends AssocEdgeQueryBase<
  FakeUser,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(
      viewer,
      src,
      EdgeType.UserToFriends,
      FakeUser.loaderOptions(),
      AssocEdge,
    );
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

  queryCustomEdge(): UserToCustomEdgeQuery {
    return UserToCustomEdgeQuery.query(this.viewer, this);
  }
}

// example with custom method
export class CustomEdge extends AssocEdge {
  async loadUser(viewer: Viewer) {
    return await FakeUser.load(viewer, this.id2);
  }
}

export class UserToCustomEdgeQuery extends AssocEdgeQueryBase<
  FakeUser,
  FakeUser,
  CustomEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(
      viewer,
      src,
      EdgeType.UserToCustomEdge,
      FakeUser.loaderOptions(),
      CustomEdge,
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser>,
  ): UserToCustomEdgeQuery {
    return new UserToCustomEdgeQuery(viewer, src);
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

export class UserToFriendRequestsQuery extends AssocEdgeQueryBase<
  FakeUser,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(
      viewer,
      src,
      EdgeType.UserToFriendRequests,
      FakeUser.loaderOptions(),
      AssocEdge,
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser>,
  ): UserToFriendRequestsQuery {
    return new UserToFriendRequestsQuery(viewer, src);
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

  queryCustomEdge(): UserToCustomEdgeQuery {
    return UserToCustomEdgeQuery.query(this.viewer, this);
  }
}

export class UserToIncomingFriendRequestsQuery extends AssocEdgeQueryBase<
  FakeUser,
  FakeUser,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(
      viewer,
      src,
      EdgeType.UserToIncomingFriendRequests,
      FakeUser.loaderOptions(),
      AssocEdge,
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser>,
  ): UserToIncomingFriendRequestsQuery {
    return new UserToIncomingFriendRequestsQuery(viewer, src);
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

  queryCustomEdge(): UserToCustomEdgeQuery {
    return UserToCustomEdgeQuery.query(this.viewer, this);
  }
}

export class UserToEventsAttendingQuery extends AssocEdgeQueryBase<
  FakeUser,
  FakeEvent,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(
      viewer,
      src,
      EdgeType.UserToEventsAttending,
      FakeEvent.loaderOptions(),
      AssocEdge,
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

export class UserToHostedEventsQuery extends AssocEdgeQueryBase<
  FakeUser,
  FakeEvent,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(
      viewer,
      src,
      EdgeType.UserToHostedEvents,
      FakeEvent.loaderOptions(),
      AssocEdge,
    );
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
