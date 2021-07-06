// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { User } from "src/ent/";
import { UserBuilder, UserInput } from "src/ent/user/actions/user_builder";

export interface UserEditInput {
  firstName?: string;
  lastName?: string;
}

export class EditUserActionBase implements Action<User> {
  public readonly builder: UserBuilder;
  public readonly viewer: Viewer;
  protected input: UserEditInput;
  protected user: User;

  constructor(viewer: Viewer, user: User, input: UserEditInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new UserBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      user,
    );
    this.user = user;
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

  static create<T extends EditUserActionBase>(
    this: new (viewer: Viewer, user: User, input: UserEditInput) => T,
    viewer: Viewer,
    user: User,
    input: UserEditInput,
  ): EditUserActionBase {
    return new this(viewer, user, input);
  }

  static async saveXFromID<T extends EditUserActionBase>(
    this: new (viewer: Viewer, user: User, input: UserEditInput) => T,
    viewer: Viewer,
    id: ID,
    input: UserEditInput,
  ): Promise<User> {
    let user = await User.loadX(viewer, id);
    return await new this(viewer, user, input).saveX();
  }
}
