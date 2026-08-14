/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import type { PrivacyPolicy } from "@snowtop/ent";
import { Comment } from "../../index.js";
import { ExampleViewer } from "../../../viewer/viewer.js";
import { EditCommentActionBase } from "../../generated/comment/actions/edit_comment_action_base.js";
import type { CommentEditInput } from "../../generated/comment/actions/edit_comment_action_base.js";
export type { CommentEditInput };
export default class EditCommentAction extends EditCommentActionBase {
  getPrivacyPolicy(): PrivacyPolicy<Comment, ExampleViewer> {
    return AlwaysAllowPrivacyPolicy;
  }
}
