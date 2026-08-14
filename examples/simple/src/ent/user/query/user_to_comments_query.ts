/**
 * Copyright whaa whaa
 */

import { User } from "../../index.js";
import { ObjectToCommentsEdge, ObjectToCommentsQuery } from "../../internal.js";
export class UserToCommentsEdge extends ObjectToCommentsEdge {}

export class UserToCommentsQuery extends ObjectToCommentsQuery {
  getSourceLoadEntOptions() {
    return User.loaderOptions();
  }
}
