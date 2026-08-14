/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { CommentBase } from "./internal.js";

export class Comment extends CommentBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }
}
