/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
} from "@snowtop/ent";
import {
  Action,
  Changeset,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { User } from "../../..";
import { UserBuilder } from "./user_builder";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface ConfirmEditPhoneNumberInput {
  phoneNumber: string;
  code: string;
}

export type ConfirmEditPhoneNumberActionTriggers = (
  | Trigger<
      User,
      UserBuilder<ConfirmEditPhoneNumberInput, User>,
      ExampleViewerAlias,
      ConfirmEditPhoneNumberInput,
      User
    >
  | Trigger<
      User,
      UserBuilder<ConfirmEditPhoneNumberInput, User>,
      ExampleViewerAlias,
      ConfirmEditPhoneNumberInput,
      User
    >[]
)[];

export type ConfirmEditPhoneNumberActionObservers = Observer<
  User,
  UserBuilder<ConfirmEditPhoneNumberInput, User>,
  ExampleViewerAlias,
  ConfirmEditPhoneNumberInput,
  User
>[];

export type ConfirmEditPhoneNumberActionValidators = Validator<
  User,
  UserBuilder<ConfirmEditPhoneNumberInput, User>,
  ExampleViewerAlias,
  ConfirmEditPhoneNumberInput,
  User
>[];

export class ConfirmEditPhoneNumberActionBase
  implements
    Action<
      User,
      UserBuilder<ConfirmEditPhoneNumberInput, User>,
      ExampleViewerAlias,
      ConfirmEditPhoneNumberInput,
      User
    >
{
  public readonly builder: UserBuilder<ConfirmEditPhoneNumberInput, User>;
  public readonly viewer: ExampleViewerAlias;
  protected input: ConfirmEditPhoneNumberInput;
  protected readonly user: User;

  constructor(
    viewer: ExampleViewerAlias,
    user: User,
    input: ConfirmEditPhoneNumberInput,
  ) {
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

  getTriggers(): ConfirmEditPhoneNumberActionTriggers {
    return [];
  }

  getObservers(): ConfirmEditPhoneNumberActionObservers {
    return [];
  }

  getValidators(): ConfirmEditPhoneNumberActionValidators {
    return [];
  }

  getInput(): ConfirmEditPhoneNumberInput {
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

  async save(): Promise<User | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<User> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends ConfirmEditPhoneNumberActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      user: User,
      input: ConfirmEditPhoneNumberInput,
    ) => T,
    viewer: ExampleViewerAlias,
    user: User,
    input: ConfirmEditPhoneNumberInput,
  ): T {
    return new this(viewer, user, input);
  }

  static async saveXFromID<T extends ConfirmEditPhoneNumberActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      user: User,
      input: ConfirmEditPhoneNumberInput,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
    input: ConfirmEditPhoneNumberInput,
  ): Promise<User> {
    const user = await User.loadX(viewer, id);
    return new this(viewer, user, input).saveX();
  }
}
