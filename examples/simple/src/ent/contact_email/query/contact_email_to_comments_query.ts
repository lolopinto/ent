/**
 * Copyright whaa whaa
 */

import {
  ContactEmail,
  ObjectToCommentsEdge,
  ObjectToCommentsQuery,
} from "../../internal";

export class ContactEmailToCommentsEdge extends ObjectToCommentsEdge {}

export class ContactEmailToCommentsQuery extends ObjectToCommentsQuery {
  getSourceLoadEntOptions() {
    return ContactEmail.loaderOptions();
  }
}
