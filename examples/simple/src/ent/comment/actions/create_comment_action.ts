/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { Trigger } from "@snowtop/ent/action";
import { NodeType } from "../../generated/const";
import { CommentBuilder } from "../../generated/comment/actions/comment_builder";
import {
  CommentCreateInput,
  CreateCommentActionBase,
} from "../../generated/comment/actions/create_comment_action_base";
import { Comment } from "../../../ent";

export { CommentCreateInput };

export default class CreateCommentAction extends CreateCommentActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  triggers: Trigger<
    Comment,
    CommentBuilder<Comment, Comment>,
    CommentCreateInput,
    Comment
  >[] = [
    {
      changeset(builder, input) {
        // creating the comment automatically adds the needed edges
        builder.addPostID(input.articleID, input.articleType as NodeType);
      },
    },
  ];
}
