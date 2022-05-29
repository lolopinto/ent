/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  Ent,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  WriteOperation,
} from "@snowtop/ent/action";
import { Comment, User } from "../../..";
import { CommentBuilder } from "./comment_builder";

export interface CommentCreateInput {
  authorID: ID | Builder<User>;
  body: string;
  articleID: ID | Builder<Ent>;
  articleType: string;
}

export class CreateCommentActionBase
  implements
    Action<
      Comment,
      CommentBuilder<CommentCreateInput, Comment | null>,
      CommentCreateInput,
      Comment | null
    >
{
  public readonly builder: CommentBuilder<CommentCreateInput, Comment | null>;
  public readonly viewer: Viewer;
  protected input: CommentCreateInput;

  constructor(viewer: Viewer, input: CommentCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new CommentBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
      null,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy<Comment> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): CommentCreateInput {
    return this.input;
  }

  async changeset(): Promise<Changeset<Comment>> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<Comment | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Comment> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends CreateCommentActionBase>(
    this: new (viewer: Viewer, input: CommentCreateInput) => T,
    viewer: Viewer,
    input: CommentCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
