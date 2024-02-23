/**
 * Copyright whaa whaa
 */

import {
  ContactPhoneNumber,
  ObjectToLikersEdge,
  ObjectToLikersQuery,
} from "../../internal";

export class ContactPhoneNumberToLikersEdge extends ObjectToLikersEdge {}

export class ContactPhoneNumberToLikersQuery extends ObjectToLikersQuery {
  getSourceLoadEntOptions() {
    return ContactPhoneNumber.loaderOptions();
  }
}
