/**
 * Copyright whaa whaa
 */

import { Contact } from "../../index.js";
import { ObjectToLikersEdge, ObjectToLikersQuery } from "../../internal.js";
export class ContactToLikersEdge extends ObjectToLikersEdge {}

export class ContactToLikersQuery extends ObjectToLikersQuery {
  getSourceLoadEntOptions() {
    return Contact.loaderOptions();
  }
}
