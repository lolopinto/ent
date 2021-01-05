// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Action, WriteOperation, Changeset } from "@lolopinto/ent/action";
import {
  Viewer,
  ID,
  AllowIfHasIdentity,
  PrivacyPolicy,
  AlwaysDenyRule,
} from "@lolopinto/ent";
import { User } from "src/ent/";
import { UserBuilder, UserInput } from "src/ent/user/actions/user_builder";

export interface ConfirmEditEmailAddressInput {
  emailAddress: string;
  code: string;
}

export class ConfirmEditEmailAddressActionBase implements Action<User> {
  public readonly builder: UserBuilder;
  public readonly viewer: Viewer;
  protected input: ConfirmEditEmailAddressInput;

  constructor(viewer: Viewer, user: User, input: ConfirmEditEmailAddressInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new UserBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      user,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [AllowIfHasIdentity, AlwaysDenyRule],
    };
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

  static create<T extends ConfirmEditEmailAddressActionBase>(
    this: new (
      viewer: Viewer,
      user: User,
      input: ConfirmEditEmailAddressInput,
    ) => T,
    viewer: Viewer,
    user: User,
    input: ConfirmEditEmailAddressInput,
  ): ConfirmEditEmailAddressActionBase {
    return new this(viewer, user, input);
  }

  static async saveXFromID<T extends ConfirmEditEmailAddressActionBase>(
    this: new (
      viewer: Viewer,
      user: User,
      input: ConfirmEditEmailAddressInput,
    ) => T,
    viewer: Viewer,
    id: ID,
    input: ConfirmEditEmailAddressInput,
  ): Promise<User> {
    let user = await User.loadX(viewer, id);
    return await new this(viewer, user, input).saveX();
  }
}
