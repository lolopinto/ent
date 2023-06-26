/**
 * Copyright whaa whaa
 */

import { OrderBy } from "@snowtop/ent";
import { ArticleToCommentsQuery, UserBase } from "../../internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

export class UserArticleToCommentsQuery extends ArticleToCommentsQuery {
  constructor(
    viewer: ExampleViewerAlias,
    srcEnt: UserBase,
    sortColumn?: string | OrderBy,
  ) {
    super(viewer, srcEnt, sortColumn);
  }
}
