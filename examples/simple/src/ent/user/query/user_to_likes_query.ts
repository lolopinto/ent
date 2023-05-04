/**
 * Copyright whaa whaa
 */

import { AssocEdge } from "@snowtop/ent";
import { UserToLikesQueryBase } from "../../internal";
import { gqlField } from "@snowtop/ent/graphql";

export class UserToLikesEdge extends AssocEdge {
  @gqlField({ nodeName: "UserToLikesEdge", type: "Date", name: "time" })
  getTime(): Date {
    return this.time;
  }
}

export class UserToLikesQuery extends UserToLikesQueryBase {}
