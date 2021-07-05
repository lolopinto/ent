// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
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
import { Account, Tag } from "src/ent/";
import { TagBuilder, TagInput } from "src/ent/tag/actions/tag_builder";

export interface TagCreateInput {
  displayName: string;
  ownerID: ID | Builder<Account>;
}

export class CreateTagActionBase implements Action<Tag> {
  public readonly builder: TagBuilder;
  public readonly viewer: Viewer;
  protected input: TagCreateInput;

  constructor(viewer: Viewer, input: TagCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new TagBuilder(this.viewer, WriteOperation.Insert, this);
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): TagInput {
    return this.input;
  }

  async changeset(): Promise<Changeset<Tag>> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<Tag | null> {
    await this.builder.save();
    return await this.builder.editedEnt();
  }

  async saveX(): Promise<Tag> {
    await this.builder.saveX();
    return await this.builder.editedEntX();
  }

  static create<T extends CreateTagActionBase>(
    this: new (viewer: Viewer, input: TagCreateInput) => T,
    viewer: Viewer,
    input: TagCreateInput,
  ): CreateTagActionBase {
    return new this(viewer, input);
  }
}
