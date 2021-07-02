// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/snowtop-ts";
import { Action, Changeset, WriteOperation } from "@snowtop/snowtop-ts/action";
import { User } from "src/ent/";
import { UserBuilder, UserInput } from "src/ent/user/actions/user_builder";

export interface UserCreateInput {
  firstName: string;
  lastName: string;
  emailAddress: string;
  password: string;
}

export class CreateUserActionBase implements Action<User> {
  public readonly builder: UserBuilder;
  public readonly viewer: Viewer;
  protected input: UserCreateInput;

  constructor(viewer: Viewer, input: UserCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new UserBuilder(this.viewer, WriteOperation.Insert, this);
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): UserInput {
    return this.input;
  }

  async changeset(): Promise<Changeset<User>> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<User | null> {
    await this.builder.save();
    return await this.builder.editedEnt();
  }

  async saveX(): Promise<User> {
    await this.builder.saveX();
    return await this.builder.editedEntX();
  }

  static create<T extends CreateUserActionBase>(
    this: new (viewer: Viewer, input: UserCreateInput) => T,
    viewer: Viewer,
    input: UserCreateInput,
  ): CreateUserActionBase {
    return new this(viewer, input);
  }
}
