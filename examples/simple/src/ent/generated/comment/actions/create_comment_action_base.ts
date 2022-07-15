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
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface CommentCreateInput {
  authorID: ID | Builder<User, ExampleViewerAlias>;
  body: string;
  articleID: ID | Builder<Ent<ExampleViewerAlias>, ExampleViewerAlias>;
  articleType: string;
}

export type CreateCommentActionTriggers = (
  | Trigger<
      Comment,
      CommentBuilder<CommentCreateInput, Comment | null>,
      ExampleViewerAlias,
      CommentCreateInput,
      Comment | null
    >
  | Trigger<
      Comment,
      CommentBuilder<CommentCreateInput, Comment | null>,
      ExampleViewerAlias,
      CommentCreateInput,
      Comment | null
    >[]
)[];

export type CreateCommentActionObservers = Observer<
  Comment,
  CommentBuilder<CommentCreateInput, Comment | null>,
  ExampleViewerAlias,
  CommentCreateInput,
  Comment | null
>[];

export type CreateCommentActionValidators = Validator<
  Comment,
  CommentBuilder<CommentCreateInput, Comment | null>,
  ExampleViewerAlias,
  CommentCreateInput,
  Comment | null
>[];

export class CreateCommentActionBase
  implements
    Action<
      Comment,
      CommentBuilder<CommentCreateInput, Comment | null>,
      ExampleViewerAlias,
      CommentCreateInput,
      Comment | null
    >
{
  public readonly builder: CommentBuilder<CommentCreateInput, Comment | null>;
  public readonly viewer: ExampleViewerAlias;
  protected input: CommentCreateInput;

  constructor(viewer: ExampleViewerAlias, input: CommentCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new CommentBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
      null,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy<Comment, ExampleViewerAlias> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): CreateCommentActionTriggers {
    return [];
  }

  getObservers(): CreateCommentActionObservers {
    return [];
  }

  getValidators(): CreateCommentActionValidators {
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
    this: new (viewer: ExampleViewerAlias, input: CommentCreateInput) => T,
    viewer: ExampleViewerAlias,
    input: CommentCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
