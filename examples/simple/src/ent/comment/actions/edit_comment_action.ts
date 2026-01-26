/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import type { PrivacyPolicy } from "@snowtop/ent";
import { Comment } from "src/ent";
import { ExampleViewer } from "src/viewer/viewer";
import { EditCommentActionBase } from "../../generated/comment/actions/edit_comment_action_base";
import type { CommentEditInput } from "../../generated/comment/actions/edit_comment_action_base";
export type { CommentEditInput };
export default class EditCommentAction extends EditCommentActionBase {
  getPrivacyPolicy(): PrivacyPolicy<Comment, ExampleViewer> {
    return AlwaysAllowPrivacyPolicy;
  }
}
