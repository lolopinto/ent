/**
 * Copyright whaa whaa
 */

import { Contact } from "../..";
import { ObjectToLikersEdge, ObjectToLikersQuery } from "../../internal";
export class ContactToLikersEdge extends ObjectToLikersEdge {}

export class ContactToLikersQuery extends ObjectToLikersQuery {
  getSourceLoadEntOptions() {
    return Contact.loaderOptions();
  }
}
