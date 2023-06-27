/**
 * Copyright whaa whaa
 */

import { OrderBy } from "@snowtop/ent";
import { CommentsFromAttachmentQuery, UserBase } from "../../internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

export class UserCommentsFromAttachmentQuery extends CommentsFromAttachmentQuery {
  constructor(
    viewer: ExampleViewerAlias,
    srcEnt: UserBase,
    sortColumn?: string | OrderBy,
  ) {
    super(viewer, srcEnt, sortColumn);
  }
}
