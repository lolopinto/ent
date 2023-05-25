/**
 * Copyright whaa whaa
 */

import { ArticleToCommentsQuery, UserBase } from "../../internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

export class UserArticleToCommentsQuery extends ArticleToCommentsQuery {
  constructor(
    viewer: ExampleViewerAlias,
    srcEnt: UserBase,
    sortColumn?: string,
  ) {
    super(viewer, srcEnt, sortColumn);
  }
}
