/**
 * Copyright whaa whaa
 */

import {
  ContactEmail,
  ObjectToLikersEdge,
  ObjectToLikersQuery,
} from "../../internal";

export class ContactEmailToLikersEdge extends ObjectToLikersEdge {}

export class ContactEmailToLikersQuery extends ObjectToLikersQuery {
  getSourceLoadEntOptions() {
    return ContactEmail.loaderOptions();
  }
}
