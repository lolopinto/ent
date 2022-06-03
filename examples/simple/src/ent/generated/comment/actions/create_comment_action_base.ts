/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  Ent,
  ID,
  PrivacyPolicy,
} from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { Comment, User } from "../../..";
import { CommentBuilder } from "./comment_builder";
import { ExampleViewer } from "../../../../viewer/viewer";

export interface CommentCreateInput {
  authorID: ID | Builder<User, ExampleViewer>;
  body: string;
  articleID: ID | Builder<Ent<ExampleViewer>, ExampleViewer>;
  articleType: string;
}

export class CreateCommentActionBase
  implements
    Action<
      Comment,
      CommentBuilder<CommentCreateInput, Comment | null>,
      ExampleViewer,
      CommentCreateInput,
      Comment | null
    >
{
  public readonly builder: CommentBuilder<CommentCreateInput, Comment | null>;
  public readonly viewer: ExampleViewer;
  protected input: CommentCreateInput;

  constructor(viewer: ExampleViewer, input: CommentCreateInput) {
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

  getTriggers(): Trigger<
    Comment,
    CommentBuilder,
    ExampleViewer,
    CommentCreateInput,
    Comment | null
  >[] {
    return [];
  }

  getObservers(): Observer<
    Comment,
    CommentBuilder,
    ExampleViewer,
    CommentCreateInput,
    Comment | null
  >[] {
    return [];
  }

  getValidators(): Validator<
    Comment,
    CommentBuilder,
    ExampleViewer,
    CommentCreateInput,
    Comment | null
  >[] {
    return [];
  }

  getInput(): CommentCreateInput {
    return this.input;
  }

  async changeset(): Promise<Changeset> {
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
    this: new (viewer: ExampleViewer, input: CommentCreateInput) => T,
    viewer: ExampleViewer,
    input: CommentCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
