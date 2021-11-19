/**
 * Copyright whaa whaa
 */

import { User } from "../..";
import { ObjectToLikersEdge, ObjectToLikersQuery } from "../../internal";
export class UserToLikersEdge extends ObjectToLikersEdge {}

export class UserToLikersQuery extends ObjectToLikersQuery {
  getSourceLoadEntOptions() {
    return User.loaderOptions();
  }
}
