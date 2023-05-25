/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AssocEdgeCountLoaderFactory,
  AssocEdgeLoaderFactory,
  AssocEdgeQueryBase,
  CustomEdgeQueryBase,
  EdgeQuerySource,
  Ent,
  ID,
} from "@snowtop/ent";
import { getLoaderOptions } from "./loadAny";
import { EdgeType, NodeType } from "./types";
import { Comment, CommentToPostEdge, UserBase } from "../internal";
import { ExampleViewer as ExampleViewerAlias } from "../../viewer/viewer";

export const commentToPostCountLoaderFactory = new AssocEdgeCountLoaderFactory(
  EdgeType.CommentToPost,
);
export const commentToPostDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.CommentToPost,
  () => CommentToPostEdge,
);

export abstract class CommentToPostQueryBase extends AssocEdgeQueryBase<
  Comment,
  Ent<ExampleViewerAlias>,
  CommentToPostEdge,
  ExampleViewerAlias
> {
  constructor(
    viewer: ExampleViewerAlias,
    src: EdgeQuerySource<Comment, Ent<ExampleViewerAlias>, ExampleViewerAlias>,
  ) {
    super(
      viewer,
      src,
      commentToPostCountLoaderFactory,
      commentToPostDataLoaderFactory,
      (str) => getLoaderOptions(str as NodeType),
    );
  }

  static query<T extends CommentToPostQueryBase>(
    this: new (
      viewer: ExampleViewerAlias,
      src: EdgeQuerySource<Comment, Ent<ExampleViewerAlias>>,
    ) => T,
    viewer: ExampleViewerAlias,
    src: EdgeQuerySource<Comment, Ent<ExampleViewerAlias>>,
  ): T {
    return new this(viewer, src);
  }

  sourceEnt(id: ID) {
    return Comment.load(this.viewer, id);
  }
}

export class ArticleToCommentsQueryBase<
  TEnt extends Ent<ExampleViewerAlias> = Ent<ExampleViewerAlias>,
> extends CustomEdgeQueryBase<TEnt, Comment, ExampleViewerAlias> {
  constructor(
    viewer: ExampleViewerAlias,
    private srcEnt: TEnt,
    sortColumn?: string,
  ) {
    super(viewer, {
      src: srcEnt,
      groupCol: "article_id",
      loadEntOptions: Comment.loaderOptions(),
      name: "ArticleToCommentsQuery",
      sortColumn,
    });
  }

  static query<
    T extends ArticleToCommentsQueryBase,
    TEnt extends Ent<ExampleViewerAlias> = Ent<ExampleViewerAlias>,
  >(
    this: new (
      viewer: ExampleViewerAlias,
      src: TEnt,
    ) => T,
    viewer: ExampleViewerAlias,
    src: TEnt,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(_id: ID) {
    return this.srcEnt;
  }
}

export class CommentsFromAttachmentQueryBase<
  TEnt extends Ent<ExampleViewerAlias> = Ent<ExampleViewerAlias>,
> extends CustomEdgeQueryBase<TEnt, Comment, ExampleViewerAlias> {
  constructor(
    viewer: ExampleViewerAlias,
    private srcEnt: TEnt,
    sortColumn?: string,
  ) {
    super(viewer, {
      src: srcEnt,
      groupCol: "attachment_id",
      loadEntOptions: Comment.loaderOptions(),
      name: "CommentsFromAttachmentQuery",
      sortColumn,
    });
  }

  static query<
    T extends CommentsFromAttachmentQueryBase,
    TEnt extends Ent<ExampleViewerAlias> = Ent<ExampleViewerAlias>,
  >(
    this: new (
      viewer: ExampleViewerAlias,
      src: TEnt,
    ) => T,
    viewer: ExampleViewerAlias,
    src: TEnt,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(_id: ID) {
    return this.srcEnt;
  }
}

export class AuthorToCommentsQueryBase<
  TEnt extends UserBase = UserBase,
> extends CustomEdgeQueryBase<TEnt, Comment, ExampleViewerAlias> {
  constructor(
    viewer: ExampleViewerAlias,
    private srcEnt: TEnt,
    sortColumn?: string,
  ) {
    super(viewer, {
      src: srcEnt,
      groupCol: "author_id",
      loadEntOptions: Comment.loaderOptions(),
      name: "AuthorToCommentsQuery",
      sortColumn,
    });
  }

  static query<
    T extends AuthorToCommentsQueryBase,
    TEnt extends UserBase = UserBase,
  >(
    this: new (
      viewer: ExampleViewerAlias,
      src: TEnt,
    ) => T,
    viewer: ExampleViewerAlias,
    src: TEnt,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(_id: ID) {
    return this.srcEnt;
  }
}

export class StickerToCommentsQueryBase<
  TEnt extends Ent<ExampleViewerAlias> = Ent<ExampleViewerAlias>,
> extends CustomEdgeQueryBase<TEnt, Comment, ExampleViewerAlias> {
  constructor(
    viewer: ExampleViewerAlias,
    private srcEnt: TEnt,
    sortColumn?: string,
  ) {
    super(viewer, {
      src: srcEnt,
      groupCol: "sticker_id",
      loadEntOptions: Comment.loaderOptions(),
      name: "StickerToCommentsQuery",
      sortColumn,
    });
  }

  static query<
    T extends StickerToCommentsQueryBase,
    TEnt extends Ent<ExampleViewerAlias> = Ent<ExampleViewerAlias>,
  >(
    this: new (
      viewer: ExampleViewerAlias,
      src: TEnt,
    ) => T,
    viewer: ExampleViewerAlias,
    src: TEnt,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(_id: ID) {
    return this.srcEnt;
  }
}
