/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { User } from "../../..";
import { UserBuilder } from "./user_builder";

export interface EditPhoneNumberInput {
  newPhoneNumber: string;
}

export class EditPhoneNumberActionBase
  implements
    Action<
      User,
      UserBuilder<EditPhoneNumberInput, User>,
      EditPhoneNumberInput,
      User
    >
{
  public readonly builder: UserBuilder<EditPhoneNumberInput, User>;
  public readonly viewer: Viewer;
  protected input: EditPhoneNumberInput;
  protected user: User;

  constructor(viewer: Viewer, user: User, input: EditPhoneNumberInput) {
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

  getPrivacyPolicy(): PrivacyPolicy<User> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): EditPhoneNumberInput {
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
    return this.builder.editedEnt();
  }

  async saveX(): Promise<User> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends EditPhoneNumberActionBase>(
    this: new (viewer: Viewer, user: User, input: EditPhoneNumberInput) => T,
    viewer: Viewer,
    user: User,
    input: EditPhoneNumberInput,
  ): T {
    return new this(viewer, user, input);
  }

  static async saveXFromID<T extends EditPhoneNumberActionBase>(
    this: new (viewer: Viewer, user: User, input: EditPhoneNumberInput) => T,
    viewer: Viewer,
    id: ID,
    input: EditPhoneNumberInput,
  ): Promise<User> {
    const user = await User.loadX(viewer, id);
    return new this(viewer, user, input).saveX();
  }
}
