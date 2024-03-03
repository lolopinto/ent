/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AssocEdgeCountLoaderFactory,
  AssocEdgeLoaderFactory,
  AssocEdgeQueryBase,
  EdgeQuerySource,
  ID,
} from "@snowtop/ent";
import { EdgeType } from "./types";
import {
  Contact,
  ContactToSelfContactForUserEdge,
  User,
  UserToCommentsQuery,
  UserToCreatedEventsQuery,
  UserToDeclinedEventsQuery,
  UserToEventsAttendingQuery,
  UserToFriendsQuery,
  UserToHostedEventsQuery,
  UserToInvitedEventsQuery,
  UserToLikersQuery,
  UserToLikesQuery,
  UserToMaybeEventsQuery,
  UserToSelfContactQuery,
} from "../internal";
import { ExampleViewer as ExampleViewerAlias } from "../../viewer/viewer";

export const contactToSelfContactForUserCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.ContactToSelfContactForUser);
export const contactToSelfContactForUserDataLoaderFactory =
  new AssocEdgeLoaderFactory(
    EdgeType.ContactToSelfContactForUser,
    () => ContactToSelfContactForUserEdge,
  );

export abstract class ContactToSelfContactForUserQueryBase extends AssocEdgeQueryBase<
  Contact,
  User,
  ContactToSelfContactForUserEdge,
  ExampleViewerAlias
> {
  constructor(
    viewer: ExampleViewerAlias,
    src: EdgeQuerySource<Contact, User, ExampleViewerAlias>,
  ) {
    super(
      viewer,
      src,
      contactToSelfContactForUserCountLoaderFactory,
      contactToSelfContactForUserDataLoaderFactory,
      User.loaderOptions(),
    );
  }

  static query<T extends ContactToSelfContactForUserQueryBase>(
    this: new (
      viewer: ExampleViewerAlias,
      src: EdgeQuerySource<Contact, User>,
    ) => T,
    viewer: ExampleViewerAlias,
    src: EdgeQuerySource<Contact, User>,
  ): T {
    return new this(viewer, src);
  }

  sourceEnt(id: ID) {
    return Contact.load(this.viewer, id);
  }

  queryComments(): UserToCommentsQuery {
    return UserToCommentsQuery.query(this.viewer, this);
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

  queryLikers(): UserToLikersQuery {
    return UserToLikersQuery.query(this.viewer, this);
  }

  queryLikes(): UserToLikesQuery {
    return UserToLikesQuery.query(this.viewer, this);
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