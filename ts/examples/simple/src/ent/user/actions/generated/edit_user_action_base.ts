// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Action, WriteOperation, Changeset } from "@lolopinto/ent/action";
import { Viewer, ID } from "@lolopinto/ent";
import User from "src/ent/user";
import { UserBuilder, UserInput } from "src/ent/user/actions/user_builder";

export interface UserEditInput {
  firstName?: string;
  lastName?: string;
}

export class EditUserActionBase implements Action<User> {
  public readonly builder: UserBuilder;
  public readonly viewer: Viewer;
  private input: UserEditInput;

  constructor(viewer: Viewer, user: User, input: UserEditInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new UserBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      user,
    );
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
