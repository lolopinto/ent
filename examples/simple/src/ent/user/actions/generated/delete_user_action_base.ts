// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { User } from "../../..";
import { UserBuilder, UserInput } from "../user_builder";

export class DeleteUserActionBase implements Action<User> {
  public readonly builder: UserBuilder;
  public readonly viewer: Viewer;
  protected user: User;

  constructor(viewer: Viewer, user: User) {
    this.viewer = viewer;
    this.builder = new UserBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      user,
    );
    this.user = user;
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): UserInput {
    return {};
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

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  static create<T extends DeleteUserActionBase>(
    this: new (viewer: Viewer, user: User) => T,
    viewer: Viewer,
    user: User,
  ): DeleteUserActionBase {
    return new this(viewer, user);
  }

  static async saveXFromID<T extends DeleteUserActionBase>(
    this: new (viewer: Viewer, user: User) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    let user = await User.loadX(viewer, id);
    return await new this(viewer, user).saveX();
  }
}
