/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  CommentCreateInput,
  CreateCommentActionBase,
} from "./generated/create_comment_action_base";

export { CommentCreateInput };

export default class CreateCommentAction extends CreateCommentActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
