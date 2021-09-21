/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { CommentBase } from "./internal";

export class Comment extends CommentBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;
}
