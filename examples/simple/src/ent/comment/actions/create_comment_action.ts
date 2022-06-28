/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy, Ent } from "@snowtop/ent";
import { Trigger } from "@snowtop/ent/action";
import { NodeType } from "../../generated/const";
import { CommentBuilder } from "./generated/comment_builder";
import {
  CommentCreateInput,
  CreateCommentActionBase,
} from "./generated/create_comment_action_base";

export { CommentCreateInput };

export default class CreateCommentAction extends CreateCommentActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  triggers: Trigger<Ent>[] = [
    {
      changeset(builder: CommentBuilder, input: CommentCreateInput) {
        // creating the comment automatically adds the needed edges
        builder.addPostID(input.articleID, input.articleType as NodeType);
      },
    },
  ];
}
