// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Action, WriteOperation, Changeset } from "ent/action";
import { Viewer } from "ent/ent";
import User from "src/ent/user";
import { UserBuilder, UserInput } from "src/ent/user/actions/user_builder";

export interface UserCreateInput {
  firstName: string;
  lastName: string;
  emailAddress: string;
}

export class CreateUserActionBase implements Action<User> {
  public readonly builder: UserBuilder;
  public readonly viewer: Viewer;
  private input: UserCreateInput;

  constructor(viewer: Viewer, input: UserCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new UserBuilder(this.viewer, WriteOperation.Insert, this);
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
