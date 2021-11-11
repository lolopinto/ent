/**
 * Copyright whaa whaa
 */

import { User } from "../..";
import { ObjectToCommentsEdge, ObjectToCommentsQuery } from "../../internal";
export class UserToCommentsEdge extends ObjectToCommentsEdge {}

export class UserToCommentsQuery extends ObjectToCommentsQuery {
  getSourceLoadEntOptions() {
    return User.loaderOptions();
  }
}
