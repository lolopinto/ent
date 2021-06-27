import { Ent, ID, Viewer } from "../../core/base";
import { CustomEdgeQueryBase } from "../../core/query/custom_query";
import { AssocEdge } from "../../core/ent";
import {
  AssocEdgeQueryBase,
  EdgeQuerySource,
} from "../../core/query/assoc_query";
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
import { RawCountLoaderFactory } from "../../core/loaders/raw_count_loader";
import { AssocEdgeCountLoaderFactory } from "../../core/loaders/assoc_count_loader";
import { AssocEdgeLoaderFactory } from "../../core/loaders/assoc_edge_loader";
import { IndexLoaderFactory } from "../../core/loaders/index_loader";
import { contactLoader } from "./fake_contact";

export class UserToContactsQuery extends AssocEdgeQueryBase<
  FakeUser,
  FakeContact,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(
      viewer,
      src,
      new AssocEdgeCountLoaderFactory(EdgeType.UserToContacts),
      new AssocEdgeLoaderFactory(EdgeType.UserToContacts, AssocEdge),
      FakeContact.loaderOptions(),
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser>,
  ): UserToContactsQuery {
    return new UserToContactsQuery(viewer, src);
  }
}

export const userToContactsCountLoaderFactory = new RawCountLoaderFactory({
  ...FakeContact.loaderOptions(),
  groupCol: "user_id",
});
export const userToContactsDataLoaderFactory = new IndexLoaderFactory(
  FakeContact.loaderOptions(),
  "user_id",
  {
    toPrime: [contactLoader],
  },
);

export class UserToContactsFkeyQuery extends CustomEdgeQueryBase<FakeContact> {
  constructor(viewer: Viewer, src: ID | FakeUser) {
    super(viewer, {
      src,
      // we want to reuse this and not create a new one every time...
      countLoaderFactory: userToContactsCountLoaderFactory,
      dataLoaderFactory: userToContactsDataLoaderFactory,
      options: FakeContact.loaderOptions(),
    });
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
      new AssocEdgeCountLoaderFactory(EdgeType.UserToFriends),
      new AssocEdgeLoaderFactory(EdgeType.UserToFriends, AssocEdge),
      FakeUser.loaderOptions(),
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
      new AssocEdgeCountLoaderFactory(EdgeType.UserToCustomEdge),
      new AssocEdgeLoaderFactory(EdgeType.UserToCustomEdge, CustomEdge),
      FakeUser.loaderOptions(),
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
      new AssocEdgeCountLoaderFactory(EdgeType.UserToFriendRequests),
      new AssocEdgeLoaderFactory(EdgeType.UserToFriendRequests, AssocEdge),
      FakeUser.loaderOptions(),
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
      new AssocEdgeCountLoaderFactory(EdgeType.UserToIncomingFriendRequests),
      new AssocEdgeLoaderFactory(
        EdgeType.UserToIncomingFriendRequests,
        AssocEdge,
      ),
      FakeUser.loaderOptions(),
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
      new AssocEdgeCountLoaderFactory(EdgeType.UserToEventsAttending),
      new AssocEdgeLoaderFactory(EdgeType.UserToEventsAttending, AssocEdge),
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

export class UserToHostedEventsQuery extends AssocEdgeQueryBase<
  FakeUser,
  FakeEvent,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser>) {
    super(
      viewer,
      src,
      new AssocEdgeCountLoaderFactory(EdgeType.UserToHostedEvents),
      new AssocEdgeLoaderFactory(EdgeType.UserToHostedEvents, AssocEdge),
      FakeEvent.loaderOptions(),
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
