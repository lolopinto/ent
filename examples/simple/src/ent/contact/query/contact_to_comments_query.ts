/**
 * Copyright whaa whaa
 */

import { Contact } from "../../index.js";
import { ObjectToCommentsEdge, ObjectToCommentsQuery } from "../../internal.js";
export class ContactToCommentsEdge extends ObjectToCommentsEdge {}

export class ContactToCommentsQuery extends ObjectToCommentsQuery {
  getSourceLoadEntOptions() {
    return Contact.loaderOptions();
  }
}
