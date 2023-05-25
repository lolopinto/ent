/**
 * Copyright whaa whaa
 */

import { CommentsFromAttachmentQuery, UserBase } from "../../internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

export class UserCommentsFromAttachmentQuery extends CommentsFromAttachmentQuery {
  constructor(
    viewer: ExampleViewerAlias,
    srcEnt: UserBase,
    sortColumn?: string,
  ) {
    super(viewer, srcEnt, sortColumn);
  }
}
