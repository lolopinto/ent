/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";
import { Comment } from "src/ent";
import { ExampleViewer } from "src/viewer/viewer";
import {
  CommentEditInput,
  EditCommentActionBase,
} from "../../generated/comment/actions/edit_comment_action_base";

export { CommentEditInput };

export default class EditCommentAction extends EditCommentActionBase {
  getPrivacyPolicy(): PrivacyPolicy<Comment, ExampleViewer> {
    return AlwaysAllowPrivacyPolicy;
  }
}
