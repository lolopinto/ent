import { Data, Ent, ID, Viewer } from "../../core/base";
import { CustomEdgeQueryBase } from "../../core/query/custom_query";
import { AssocEdge } from "../../core/ent";
import * as clause from "../../core/clause";
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
import { contactLoader } from "./fake_contact";
import { clear } from "jest-date-mock";
import { Interval } from "luxon";
import { QueryLoaderFactory } from "../../core/loaders/query_loader";
import { MockDate } from "./../mock_date";
import { getLoaderOptions } from ".";
import { AllowIfViewerPrivacyPolicy } from "../../core/privacy";

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

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
  }
}

export const userToContactsCountLoaderFactory = new RawCountLoaderFactory({
  ...FakeContact.loaderOptions(),
  groupCol: "user_id",
});
export const userToContactsDataLoaderFactory = new QueryLoaderFactory({
  ...FakeContact.loaderOptions(),
  groupCol: "user_id",
  toPrime: [contactLoader],
});

// note: this is still used in graphql tests...
export class UserToContactsFkeyQueryDeprecated extends CustomEdgeQueryBase<
  FakeUser,
  FakeContact
> {
  constructor(viewer: Viewer, src: ID | FakeUser) {
    super(viewer, {
      src,
      // we want to reuse this and not create a new one every time...
      countLoaderFactory: userToContactsCountLoaderFactory,
      dataLoaderFactory: userToContactsDataLoaderFactory,
      options: FakeContact.loaderOptions(),
      sortColumn: "created_at",
    });
  }

  static query(
    viewer: Viewer,
    src: FakeUser | ID,
  ): UserToContactsFkeyQueryDeprecated {
    return new UserToContactsFkeyQueryDeprecated(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
  }
}

// this replaces UserToContactsFkeyQueryDeprecated
export class UserToContactsFkeyQuery extends CustomEdgeQueryBase<
  FakeUser,
  FakeContact
> {
  constructor(viewer: Viewer, src: ID | FakeUser) {
    super(viewer, {
      src,
      loadEntOptions: FakeContact.loaderOptions(),
      groupCol: "user_id",
      name: "user_to_contacts",
      // instead of the id col...
      sortColumn: "created_at",
    });
  }

  static query(viewer: Viewer, src: FakeUser | ID): UserToContactsFkeyQuery {
    return new UserToContactsFkeyQuery(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
  }
}

export class UserToContactsFkeyQueryAsc extends CustomEdgeQueryBase<
  FakeUser,
  FakeContact
> {
  constructor(viewer: Viewer, src: ID | FakeUser) {
    super(viewer, {
      src,
      loadEntOptions: FakeContact.loaderOptions(),
      groupCol: "user_id",
      name: "user_to_contacts",
      orderby: [
        {
          column: "created_at",
          direction: "ASC",
        },
      ],
    });
  }

  static query(viewer: Viewer, src: FakeUser | ID): UserToContactsFkeyQuery {
    return new UserToContactsFkeyQueryAsc(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
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

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
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
  deleted_at: Date | null = null;

  constructor(data: Data) {
    super(data);
    this.deleted_at = data.deleted_at;
  }

  async loadUser(viewer: Viewer) {
    return FakeUser.load(viewer, this.id2);
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

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
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

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
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
  CustomEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser, FakeUser>) {
    super(
      viewer,
      src,
      new AssocEdgeCountLoaderFactory(EdgeType.UserToIncomingFriendRequests),
      new AssocEdgeLoaderFactory(
        EdgeType.UserToIncomingFriendRequests,
        CustomEdge,
      ),
      FakeUser.loaderOptions(),
    );
  }

  getPrivacyPolicy() {
    return AllowIfViewerPrivacyPolicy;
  }

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser, FakeUser>,
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

  // this is generated in codegen. we'll just add it manually here
  withoutTransformations(): this {
    this.configureEdgeQueryableDataOptions({
      disableTransformations: true,
    });
    return this;
  }
}

export class UserToEventsAttendingQuery extends AssocEdgeQueryBase<
  FakeUser,
  FakeEvent,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser, FakeEvent>) {
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
    src: EdgeQuerySource<FakeUser, FakeEvent>,
  ): UserToEventsAttendingQuery {
    return new UserToEventsAttendingQuery(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
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
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser, FakeEvent>) {
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
    src: EdgeQuerySource<FakeUser, FakeEvent>,
  ): UserToHostedEventsQuery {
    return new UserToHostedEventsQuery(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
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

export const getNextWeekClause = (): clause.Clause => {
  // get events starting within the next week

  clear();
  const start = MockDate.getDate();
  // 7 days
  const end = Interval.after(start, 86400 * 1000 * 7)
    .end.toUTC()
    .toISO();

  return clause.And(
    clause.GreaterEq("start_time", start.toISOString()),
    clause.LessEq("start_time", end),
  );
};

export function getCompleteClause(id: ID): clause.Clause {
  return clause.And(clause.Eq("user_id", id), getNextWeekClause());
}

export class UserToEventsInNextWeekQuery extends CustomEdgeQueryBase<
  FakeUser,
  FakeEvent
> {
  constructor(viewer: Viewer, src: ID | FakeUser) {
    super(viewer, {
      src,
      groupCol: "user_id",
      clause: getNextWeekClause(),
      loadEntOptions: FakeEvent.loaderOptions(),
      name: "events_in_next_week",
      sortColumn: "start_time",
    });
  }

  static query(
    viewer: Viewer,
    src: FakeUser | ID,
  ): UserToEventsInNextWeekQuery {
    return new UserToEventsInNextWeekQuery(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
  }

  getPrivacyPolicy() {
    return AllowIfViewerPrivacyPolicy;
  }
}

export class UserToFollowingQuery extends AssocEdgeQueryBase<
  FakeUser,
  Ent,
  AssocEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<FakeUser, FakeUser>) {
    super(
      viewer,
      src,
      new AssocEdgeCountLoaderFactory(EdgeType.UserToFollowing),
      new AssocEdgeLoaderFactory(EdgeType.UserToFollowing, AssocEdge),
      getLoaderOptions,
    );
  }

  static query(
    viewer: Viewer,
    src: EdgeQuerySource<FakeUser, FakeUser>,
  ): UserToFollowingQuery {
    return new UserToFollowingQuery(viewer, src);
  }

  sourceEnt(id: ID) {
    return FakeUser.load(this.viewer, id);
  }
}
