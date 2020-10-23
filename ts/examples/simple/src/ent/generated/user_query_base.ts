// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { EdgeType, User, Event, Contact } from "src/ent/internal";
import { Viewer, EdgeQuerySource, BaseEdgeQuery } from "@lolopinto/ent";

export class UserToCreatedEventsQuery extends BaseEdgeQuery<User, Event> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToCreatedEvents, Event.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToCreatedEventsQuery {
    return new UserToCreatedEventsQuery(viewer, src);
  }
}

export class UserToFriendsQuery extends BaseEdgeQuery<User, User> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToFriends, User.loaderOptions());
  }

  static query(viewer: Viewer, src: EdgeQuerySource<User>): UserToFriendsQuery {
    return new UserToFriendsQuery(viewer, src);
  }
}

export class UserToSelfContactQuery extends BaseEdgeQuery<User, Contact> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToSelfContact, Contact.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToSelfContactQuery {
    return new UserToSelfContactQuery(viewer, src);
  }
}

export class UserToInvitedEventsQuery extends BaseEdgeQuery<User, Event> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToInvitedEvents, Event.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToInvitedEventsQuery {
    return new UserToInvitedEventsQuery(viewer, src);
  }
}

export class UserToEventsAttendingQuery extends BaseEdgeQuery<User, Event> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToEventsAttending, Event.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToEventsAttendingQuery {
    return new UserToEventsAttendingQuery(viewer, src);
  }
}

export class UserToDeclinedEventsQuery extends BaseEdgeQuery<User, Event> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToDeclinedEvents, Event.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToDeclinedEventsQuery {
    return new UserToDeclinedEventsQuery(viewer, src);
  }
}

export class UserToMaybeEventsQuery extends BaseEdgeQuery<User, Event> {
  constructor(viewer: Viewer, src: EdgeQuerySource<User>) {
    super(viewer, src, EdgeType.UserToMaybeEvents, Event.loaderOptions());
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<User>,
  ): UserToMaybeEventsQuery {
    return new UserToMaybeEventsQuery(viewer, src);
  }
}
