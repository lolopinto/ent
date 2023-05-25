/**
 * Copyright whaa whaa
 */

import { CommentsFromAttachmentQuery, ContactBase } from "../../internal";
import { ExampleViewer as ExampleViewerAlias } from "../../../viewer/viewer";

export class ContactCommentsFromAttachmentQuery extends CommentsFromAttachmentQuery {
  constructor(
    viewer: ExampleViewerAlias,
    srcEnt: ContactBase,
    sortColumn?: string,
  ) {
    super(viewer, srcEnt, sortColumn);
  }
}
