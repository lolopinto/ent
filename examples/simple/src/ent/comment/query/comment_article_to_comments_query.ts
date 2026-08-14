/**
 * Copyright whaa whaa
 */

import { OrderBy } from "@snowtop/ent";
import { ArticleToCommentsQuery, CommentBase } from "../../internal.js";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer.js";

export class CommentArticleToCommentsQuery extends ArticleToCommentsQuery {
  constructor(
    viewer: ExampleViewerAlias,
    srcEnt: CommentBase,
    sortColumn?: string | OrderBy,
  ) {
    super(viewer, srcEnt, sortColumn);
  }
}
