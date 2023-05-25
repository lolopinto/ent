/**
 * Copyright whaa whaa
 */

import { ArticleToCommentsQuery, CommentBase } from "../../internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

export class CommentArticleToCommentsQuery extends ArticleToCommentsQuery {
  constructor(
    viewer: ExampleViewerAlias,
    srcEnt: CommentBase,
    sortColumn?: string,
  ) {
    super(viewer, srcEnt, sortColumn);
  }
}
