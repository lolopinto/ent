// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Action, WriteOperation, Changeset } from "ent/action";
import { Viewer, ID } from "ent/ent";
import User from "src/ent/user";
import { UserBuilder, UserInput } from "src/ent/user/actions/user_builder";

export class DeleteUserActionBase implements Action<User> {
  public readonly builder: UserBuilder;
  public readonly viewer: Viewer;

  constructor(viewer: Viewer, user: User) {
    this.viewer = viewer;
    this.builder = new UserBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      user,
    );
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

  static async saveFromID<T extends DeleteUserActionBase>(
    this: new (viewer: Viewer, user: User) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    let user = await User.load(viewer, id);
    if (!user) {
      return;
    }
    return await new this(viewer, user).save();
  }
}
