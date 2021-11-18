/**
 * Copyright whaa whaa
 */

import { Contact } from "../..";
import { ObjectToCommentsEdge, ObjectToCommentsQuery } from "../../internal";
export class ContactToCommentsEdge extends ObjectToCommentsEdge {}

export class ContactToCommentsQuery extends ObjectToCommentsQuery {
  getSourceLoadEntOptions() {
    return Contact.loaderOptions();
  }
}
