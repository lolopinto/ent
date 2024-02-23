/**
 * Copyright whaa whaa
 */

import {
  ContactPhoneNumber,
  ObjectToCommentsEdge,
  ObjectToCommentsQuery,
} from "../../internal";

export class ContactPhoneNumberToCommentsEdge extends ObjectToCommentsEdge {}

export class ContactPhoneNumberToCommentsQuery extends ObjectToCommentsQuery {
  getSourceLoadEntOptions() {
    return ContactPhoneNumber.loaderOptions();
  }
}
