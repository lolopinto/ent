/**
 * Copyright whaa whaa
 */

import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import type { Trigger } from "@snowtop/ent/action";
import { CommentBuilder } from "../../generated/comment/actions/comment_builder";
import { CreateCommentActionBase } from "../../generated/comment/actions/create_comment_action_base";
import type { CommentCreateInput } from "../../generated/comment/actions/create_comment_action_base";
import { Comment } from "../../../ent";
import { ExampleViewer } from "../../../viewer/viewer";

import { NodeType } from "../../generated/types";
export type { CommentCreateInput };
export default class CreateCommentAction extends CreateCommentActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  getTriggers(): Trigger<
    Comment,
    CommentBuilder<CommentCreateInput, Comment | null>,
    ExampleViewer,
    CommentCreateInput,
    Comment | null
  >[] {
    return [
      {
        changeset(builder, input) {
          // creating the comment automatically adds the needed edges
          builder.addPostID(input.articleId, input.articleType as NodeType);
        },
      },
    ];
  }
}
