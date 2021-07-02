// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AssocEdgeCountLoaderFactory,
  AssocEdgeLoaderFactory,
  AssocEdgeQueryBase,
  CustomEdgeQueryBase,
  EdgeQuerySource,
  ID,
  IndexLoaderFactory,
  RawCountLoaderFactory,
  Viewer,
} from "@snowtop/snowtop-ts";
import {
  AuthCode,
  Contact,
  EdgeType,
  Event,
  EventToAttendingQuery,
  EventToDeclinedQuery,
  EventToHostsQuery,
  EventToInvitedQuery,
  EventToMaybeQuery,
  User,
  UserToCreatedEventsEdge,
  UserToCreatedEventsQuery,
  UserToDeclinedEventsEdge,
  UserToDeclinedEventsQuery,
  UserToEventsAttendingEdge,
  UserToEventsAttendingQuery,
  UserToFriendsEdge,
  UserToFriendsQuery,
  UserToHostedEventsEdge,
  UserToHostedEventsQuery,
  UserToInvitedEventsEdge,
  UserToInvitedEventsQuery,
  UserToMaybeEventsEdge,
  UserToMaybeEventsQuery,
  UserToSelfContactEdge,
  UserToSelfContactQuery,
  authCodeLoader,
  contactLoader,
} from "src/ent/internal";

export const userToCreatedEventsCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.UserToCreatedEvents);
export const userToCreatedEventsDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.UserToCreatedEvents,
  () => UserToCreatedEventsEdge,
);

export const userToDeclinedEventsCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.UserToDeclinedEvents);
export const userToDeclinedEventsDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.UserToDeclinedEvents,
  () => UserToDeclinedEventsEdge,
);

export const userToEventsAttendingCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.UserToEventsAttending);
export const userToEventsAttendingDataLoaderFactory =
  new AssocEdgeLoaderFactory(
    EdgeType.UserToEventsAttending,
    () => UserToEventsAttendingEdge,
  );

export const userToFriendsCountLoaderFactory = new AssocEdgeCountLoaderFactory(
  EdgeType.UserToFriends,
);
export const userToFriendsDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.UserToFriends,
  () => UserToFriendsEdge,
);

export const userToInvitedEventsCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.UserToInvitedEvents);
export const userToInvitedEventsDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.UserToInvitedEvents,
  () => UserToInvitedEventsEdge,
);

export const userToMaybeEventsCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.UserToMaybeEvents);
export const userToMaybeEventsDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.UserToMaybeEvents,
  () => UserToMaybeEventsEdge,
);

export const userToSelfContactCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.UserToSelfContact);
export const userToSelfContactDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.UserToSelfContact,
  () => UserToSelfContactEdge,
);

export const userToHostedEventsCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.UserToHostedEvents);
export const userToHostedEventsDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.UserToHostedEvents,
  () => UserToHostedEventsEdge,
);

export const userToAuthCodesCountLoaderFactory = new RawCountLoaderFactory({
  ...AuthCode.loaderOptions(),
  groupCol: "user_id",
});
export const userToAuthCodesDataLoaderFactory = new IndexLoaderFactory(
  AuthCode.loaderOptions(),
  "user_id",
  {
    toPrime: [authCodeLoader],
  },
);
export const userToContactsCountLoaderFactory = new RawCountLoaderFactory({
  ...Contact.loaderOptions(),
  groupCol: "user_id",
});
export const userToContactsDataLoaderFactory = new IndexLoaderFactory(
  Contact.loaderOptions(),
  "user_id",
  {
    toPrime: [contactLoader],
  },
);

export class UserToCreatedEventsQueryBase extends AssocEdgeQueryBase<
  User,
  Event,
  UserToCreatedEventsEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(
      viewer,
      src,
      userToCreatedEventsCountLoaderFactory,
      userToCreatedEventsDataLoaderFactory,
      Event.loaderOptions(),
    );
  }

  static query<T extends UserToCreatedEventsQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<User>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): T {
    return new this(viewer, src);
  }

  queryAttending(): EventToAttendingQuery {
    return EventToAttendingQuery.query(this.viewer, this);
  }

  queryDeclined(): EventToDeclinedQuery {
    return EventToDeclinedQuery.query(this.viewer, this);
  }

  queryHosts(): EventToHostsQuery {
    return EventToHostsQuery.query(this.viewer, this);
  }

  queryInvited(): EventToInvitedQuery {
    return EventToInvitedQuery.query(this.viewer, this);
  }

  queryMaybe(): EventToMaybeQuery {
    return EventToMaybeQuery.query(this.viewer, this);
  }
}

export class UserToDeclinedEventsQueryBase extends AssocEdgeQueryBase<
  User,
  Event,
  UserToDeclinedEventsEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(
      viewer,
      src,
      userToDeclinedEventsCountLoaderFactory,
      userToDeclinedEventsDataLoaderFactory,
      Event.loaderOptions(),
    );
  }

  static query<T extends UserToDeclinedEventsQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<User>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): T {
    return new this(viewer, src);
  }

  queryAttending(): EventToAttendingQuery {
    return EventToAttendingQuery.query(this.viewer, this);
  }

  queryDeclined(): EventToDeclinedQuery {
    return EventToDeclinedQuery.query(this.viewer, this);
  }

  queryHosts(): EventToHostsQuery {
    return EventToHostsQuery.query(this.viewer, this);
  }

  queryInvited(): EventToInvitedQuery {
    return EventToInvitedQuery.query(this.viewer, this);
  }

  queryMaybe(): EventToMaybeQuery {
    return EventToMaybeQuery.query(this.viewer, this);
  }
}

export class UserToEventsAttendingQueryBase extends AssocEdgeQueryBase<
  User,
  Event,
  UserToEventsAttendingEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(
      viewer,
      src,
      userToEventsAttendingCountLoaderFactory,
      userToEventsAttendingDataLoaderFactory,
      Event.loaderOptions(),
    );
  }

  static query<T extends UserToEventsAttendingQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<User>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): T {
    return new this(viewer, src);
  }

  queryAttending(): EventToAttendingQuery {
    return EventToAttendingQuery.query(this.viewer, this);
  }

  queryDeclined(): EventToDeclinedQuery {
    return EventToDeclinedQuery.query(this.viewer, this);
  }

  queryHosts(): EventToHostsQuery {
    return EventToHostsQuery.query(this.viewer, this);
  }

  queryInvited(): EventToInvitedQuery {
    return EventToInvitedQuery.query(this.viewer, this);
  }

  queryMaybe(): EventToMaybeQuery {
    return EventToMaybeQuery.query(this.viewer, this);
  }
}

export class UserToFriendsQueryBase extends AssocEdgeQueryBase<
  User,
  User,
  UserToFriendsEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(
      viewer,
      src,
      userToFriendsCountLoaderFactory,
      userToFriendsDataLoaderFactory,
      User.loaderOptions(),
    );
  }

  static query<T extends UserToFriendsQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<User>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): T {
    return new this(viewer, src);
  }

  queryCreatedEvents(): UserToCreatedEventsQuery {
    return UserToCreatedEventsQuery.query(this.viewer, this);
  }

  queryDeclinedEvents(): UserToDeclinedEventsQuery {
    return UserToDeclinedEventsQuery.query(this.viewer, this);
  }

  queryEventsAttending(): UserToEventsAttendingQuery {
    return UserToEventsAttendingQuery.query(this.viewer, this);
  }

  queryFriends(): UserToFriendsQuery {
    return UserToFriendsQuery.query(this.viewer, this);
  }

  queryInvitedEvents(): UserToInvitedEventsQuery {
    return UserToInvitedEventsQuery.query(this.viewer, this);
  }

  queryMaybeEvents(): UserToMaybeEventsQuery {
    return UserToMaybeEventsQuery.query(this.viewer, this);
  }

  querySelfContact(): UserToSelfContactQuery {
    return UserToSelfContactQuery.query(this.viewer, this);
  }

  queryUserToHostedEvents(): UserToHostedEventsQuery {
    return UserToHostedEventsQuery.query(this.viewer, this);
  }
}

export class UserToInvitedEventsQueryBase extends AssocEdgeQueryBase<
  User,
  Event,
  UserToInvitedEventsEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(
      viewer,
      src,
      userToInvitedEventsCountLoaderFactory,
      userToInvitedEventsDataLoaderFactory,
      Event.loaderOptions(),
    );
  }

  static query<T extends UserToInvitedEventsQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<User>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): T {
    return new this(viewer, src);
  }

  queryAttending(): EventToAttendingQuery {
    return EventToAttendingQuery.query(this.viewer, this);
  }

  queryDeclined(): EventToDeclinedQuery {
    return EventToDeclinedQuery.query(this.viewer, this);
  }

  queryHosts(): EventToHostsQuery {
    return EventToHostsQuery.query(this.viewer, this);
  }

  queryInvited(): EventToInvitedQuery {
    return EventToInvitedQuery.query(this.viewer, this);
  }

  queryMaybe(): EventToMaybeQuery {
    return EventToMaybeQuery.query(this.viewer, this);
  }
}

export class UserToMaybeEventsQueryBase extends AssocEdgeQueryBase<
  User,
  Event,
  UserToMaybeEventsEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(
      viewer,
      src,
      userToMaybeEventsCountLoaderFactory,
      userToMaybeEventsDataLoaderFactory,
      Event.loaderOptions(),
    );
  }

  static query<T extends UserToMaybeEventsQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<User>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): T {
    return new this(viewer, src);
  }

  queryAttending(): EventToAttendingQuery {
    return EventToAttendingQuery.query(this.viewer, this);
  }

  queryDeclined(): EventToDeclinedQuery {
    return EventToDeclinedQuery.query(this.viewer, this);
  }

  queryHosts(): EventToHostsQuery {
    return EventToHostsQuery.query(this.viewer, this);
  }

  queryInvited(): EventToInvitedQuery {
    return EventToInvitedQuery.query(this.viewer, this);
  }

  queryMaybe(): EventToMaybeQuery {
    return EventToMaybeQuery.query(this.viewer, this);
  }
}

export class UserToSelfContactQueryBase extends AssocEdgeQueryBase<
  User,
  Contact,
  UserToSelfContactEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(
      viewer,
      src,
      userToSelfContactCountLoaderFactory,
      userToSelfContactDataLoaderFactory,
      Contact.loaderOptions(),
    );
  }

  static query<T extends UserToSelfContactQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<User>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): T {
    return new this(viewer, src);
  }
}

export class UserToHostedEventsQueryBase extends AssocEdgeQueryBase<
  User,
  Event,
  UserToHostedEventsEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(
      viewer,
      src,
      userToHostedEventsCountLoaderFactory,
      userToHostedEventsDataLoaderFactory,
      Event.loaderOptions(),
    );
  }

  static query<T extends UserToHostedEventsQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<User>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): T {
    return new this(viewer, src);
  }

  queryAttending(): EventToAttendingQuery {
    return EventToAttendingQuery.query(this.viewer, this);
  }

  queryDeclined(): EventToDeclinedQuery {
    return EventToDeclinedQuery.query(this.viewer, this);
  }

  queryHosts(): EventToHostsQuery {
    return EventToHostsQuery.query(this.viewer, this);
  }

  queryInvited(): EventToInvitedQuery {
    return EventToInvitedQuery.query(this.viewer, this);
  }

  queryMaybe(): EventToMaybeQuery {
    return EventToMaybeQuery.query(this.viewer, this);
  }
}

export class UserToAuthCodesQueryBase extends CustomEdgeQueryBase<AuthCode> {
  constructor(viewer: Viewer, src: User | ID) {
    super(viewer, {
      src: src,
      countLoaderFactory: userToAuthCodesCountLoaderFactory,
      dataLoaderFactory: userToAuthCodesDataLoaderFactory,
      options: AuthCode.loaderOptions(),
    });
  }

  static query<T extends UserToAuthCodesQueryBase>(
    this: new (viewer: Viewer, src: User | ID) => T,
    viewer: Viewer,
    src: User | ID,
  ): T {
    return new this(viewer, src);
  }
}

export class UserToContactsQueryBase extends CustomEdgeQueryBase<Contact> {
  constructor(viewer: Viewer, src: User | ID) {
    super(viewer, {
      src: src,
      countLoaderFactory: userToContactsCountLoaderFactory,
      dataLoaderFactory: userToContactsDataLoaderFactory,
      options: Contact.loaderOptions(),
    });
  }

  static query<T extends UserToContactsQueryBase>(
    this: new (viewer: Viewer, src: User | ID) => T,
    viewer: Viewer,
    src: User | ID,
  ): T {
    return new this(viewer, src);
  }
}
