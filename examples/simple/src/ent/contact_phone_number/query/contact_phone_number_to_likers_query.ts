/**
 * Copyright whaa whaa
 */

import {
  ContactPhoneNumber,
  ObjectToLikersEdge,
  ObjectToLikersQuery,
} from "../../internal.js";

export class ContactPhoneNumberToLikersEdge extends ObjectToLikersEdge {}

export class ContactPhoneNumberToLikersQuery extends ObjectToLikersQuery {
  getSourceLoadEntOptions() {
    return ContactPhoneNumber.loaderOptions();
  }
}
