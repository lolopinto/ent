/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AssocEdgeCountLoaderFactory,
  AssocEdgeLoaderFactory,
  AssocEdgeQueryBase,
  EdgeQuerySource,
  Ent,
  ID,
  LoadEntOptions,
  Viewer,
  loadEnt,
} from "@snowtop/ent";
import {
  Comment,
  CommentToPostQuery,
  EdgeType,
  ObjectToCommentsEdge,
  ObjectToLikersEdge,
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
} from "../../internal";

export const objectToCommentsCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.ObjectToComments);
export const objectToCommentsDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.ObjectToComments,
  () => ObjectToCommentsEdge,
);

export const objectToLikersCountLoaderFactory = new AssocEdgeCountLoaderFactory(
  EdgeType.ObjectToLikers,
);
export const objectToLikersDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.ObjectToLikers,
  () => ObjectToLikersEdge,
);

export abstract class ObjectToCommentsQueryBase extends AssocEdgeQueryBase<
  Ent,
  Comment,
  ObjectToCommentsEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Ent, Comment>) {
    super(
      viewer,
      src,
      objectToCommentsCountLoaderFactory,
      objectToCommentsDataLoaderFactory,
      Comment.loaderOptions(),
    );
  }

  static query<T extends ObjectToCommentsQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<Ent, Comment>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<Ent, Comment>,
  ): T {
    return new this(viewer, src);
  }

  protected abstract getSourceLoadEntOptions(): LoadEntOptions<Ent>;

  sourceEnt(id: ID) {
    return loadEnt(this.viewer, id, this.getSourceLoadEntOptions());
  }

  queryPost(): CommentToPostQuery {
    return CommentToPostQuery.query(this.viewer, this);
  }
}

export abstract class ObjectToLikersQueryBase extends AssocEdgeQueryBase<
  Ent,
  User,
  ObjectToLikersEdge
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Ent, User>) {
    super(
      viewer,
      src,
      objectToLikersCountLoaderFactory,
      objectToLikersDataLoaderFactory,
      User.loaderOptions(),
    );
  }

  static query<T extends ObjectToLikersQueryBase>(
    this: new (viewer: Viewer, src: EdgeQuerySource<Ent, User>) => T,
    viewer: Viewer,
    src: EdgeQuerySource<Ent, User>,
  ): T {
    return new this(viewer, src);
  }

  protected abstract getSourceLoadEntOptions(): LoadEntOptions<Ent>;

  sourceEnt(id: ID) {
    return loadEnt(this.viewer, id, this.getSourceLoadEntOptions());
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
