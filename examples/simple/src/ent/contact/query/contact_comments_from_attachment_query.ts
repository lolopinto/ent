/**
 * Copyright whaa whaa
 */

import { OrderBy } from "@snowtop/ent";
import { CommentsFromAttachmentQuery, ContactBase } from "../../internal.js";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer.js";

export class ContactCommentsFromAttachmentQuery extends CommentsFromAttachmentQuery {
  constructor(
    viewer: ExampleViewerAlias,
    srcEnt: ContactBase,
    sortColumn?: string | OrderBy,
  ) {
    super(viewer, srcEnt, sortColumn);
  }
}
