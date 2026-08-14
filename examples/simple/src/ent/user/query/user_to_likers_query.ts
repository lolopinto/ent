/**
 * Copyright whaa whaa
 */

import { User } from "../../index.js";
import { ObjectToLikersEdge, ObjectToLikersQuery } from "../../internal.js";
export class UserToLikersEdge extends ObjectToLikersEdge {}

export class UserToLikersQuery extends ObjectToLikersQuery {
  getSourceLoadEntOptions() {
    return User.loaderOptions();
  }
}
