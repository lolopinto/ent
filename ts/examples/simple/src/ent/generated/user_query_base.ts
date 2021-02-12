// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  EdgeType,
  User,
  Event,
  Contact,
  AuthCode,
  EventToAttendingQuery,
  EventToDeclinedQuery,
  EventToHostsQuery,
  EventToInvitedQuery,
  EventToMaybeQuery,
  UserToCreatedEventsQuery,
  UserToDeclinedEventsQuery,
  UserToEventsAttendingQuery,
  UserToFriendsQuery,
  UserToInvitedEventsQuery,
  UserToMaybeEventsQuery,
  UserToSelfContactQuery,
  UserToHostedEventsQuery,
  UserToCreatedEventsEdge,
  UserToDeclinedEventsEdge,
  UserToEventsAttendingEdge,
  UserToFriendsEdge,
  UserToInvitedEventsEdge,
  UserToMaybeEventsEdge,
  UserToSelfContactEdge,
  UserToHostedEventsEdge,
} from "src/ent/internal";
import {
  ID,
  Viewer,
  EdgeQuerySource,
  AssocEdgeQueryBase,
  CustomEdgeQueryBase,
  query,
} from "@lolopinto/ent";

export class UserToCreatedEventsQueryBase extends AssocEdgeQueryBase<
  User,
  Event,
  UserToCreatedEventsEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(
      viewer,
      src,
      EdgeType.UserToCreatedEvents,
      Event.loaderOptions(),
      UserToCreatedEventsEdge,
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
      EdgeType.UserToDeclinedEvents,
      Event.loaderOptions(),
      UserToDeclinedEventsEdge,
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
      EdgeType.UserToEventsAttending,
      Event.loaderOptions(),
      UserToEventsAttendingEdge,
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
      EdgeType.UserToFriends,
      User.loaderOptions(),
      UserToFriendsEdge,
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
      EdgeType.UserToInvitedEvents,
      Event.loaderOptions(),
      UserToInvitedEventsEdge,
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
      EdgeType.UserToMaybeEvents,
      Event.loaderOptions(),
      UserToMaybeEventsEdge,
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
      EdgeType.UserToSelfContact,
      Contact.loaderOptions(),
      UserToSelfContactEdge,
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
      EdgeType.UserToHostedEvents,
      Event.loaderOptions(),
      UserToHostedEventsEdge,
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
    let id: ID;
    if (typeof src === "object") {
      id = src.id;
    } else {
      id = src;
    }
    super(viewer, src, AuthCode.loaderOptions(), query.Eq("user_id", id));
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
    let id: ID;
    if (typeof src === "object") {
      id = src.id;
    } else {
      id = src;
    }
    super(viewer, src, Contact.loaderOptions(), query.Eq("user_id", id));
  }

  static query<T extends UserToContactsQueryBase>(
    this: new (viewer: Viewer, src: User | ID) => T,
    viewer: Viewer,
    src: User | ID,
  ): T {
    return new this(viewer, src);
  }
}
