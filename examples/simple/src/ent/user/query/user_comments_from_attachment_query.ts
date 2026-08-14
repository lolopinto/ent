/**
 * Copyright whaa whaa
 */

import { OrderBy } from "@snowtop/ent";
import { CommentsFromAttachmentQuery, UserBase } from "../../internal.js";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer.js";

export class UserCommentsFromAttachmentQuery extends CommentsFromAttachmentQuery {
  constructor(
    viewer: ExampleViewerAlias,
    srcEnt: UserBase,
    sortColumn?: string | OrderBy,
  ) {
    super(viewer, srcEnt, sortColumn);
  }
}
