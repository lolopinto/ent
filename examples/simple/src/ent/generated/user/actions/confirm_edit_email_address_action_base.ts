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
  ChangesetOptions,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { User } from "../../..";
import { UserBuilder } from "./user_builder";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface ConfirmEditEmailAddressInput {
  emailAddress: string;
  code: string;
}

export type ConfirmEditEmailAddressActionTriggers = (
  | Trigger<
      User,
      UserBuilder<ConfirmEditEmailAddressInput, User>,
      ExampleViewerAlias,
      ConfirmEditEmailAddressInput,
      User
    >
  | Trigger<
      User,
      UserBuilder<ConfirmEditEmailAddressInput, User>,
      ExampleViewerAlias,
      ConfirmEditEmailAddressInput,
      User
    >[]
)[];

export type ConfirmEditEmailAddressActionObservers = Observer<
  User,
  UserBuilder<ConfirmEditEmailAddressInput, User>,
  ExampleViewerAlias,
  ConfirmEditEmailAddressInput,
  User
>[];

export type ConfirmEditEmailAddressActionValidators = Validator<
  User,
  UserBuilder<ConfirmEditEmailAddressInput, User>,
  ExampleViewerAlias,
  ConfirmEditEmailAddressInput,
  User
>[];

export class ConfirmEditEmailAddressActionBase
  implements
    Action<
      User,
      UserBuilder<ConfirmEditEmailAddressInput, User>,
      ExampleViewerAlias,
      ConfirmEditEmailAddressInput,
      User
    >
{
  public readonly builder: UserBuilder<ConfirmEditEmailAddressInput, User>;
  public readonly viewer: ExampleViewerAlias;
  protected input: ConfirmEditEmailAddressInput;
  protected readonly user: User;

  constructor(
    viewer: ExampleViewerAlias,
    user: User,
    input: ConfirmEditEmailAddressInput,
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

  getPrivacyPolicy(): PrivacyPolicy<User, ExampleViewerAlias> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): ConfirmEditEmailAddressActionTriggers {
    return [];
  }

  getObservers(): ConfirmEditEmailAddressActionObservers {
    return [];
  }

  getValidators(): ConfirmEditEmailAddressActionValidators {
    return [];
  }

  getInput(): ConfirmEditEmailAddressInput {
    return this.input;
  }

  async changeset(): Promise<Changeset> {
    return this.builder.build();
  }

  async changesetWithOptions_BETA(
    options: ChangesetOptions,
  ): Promise<Changeset> {
    return this.builder.buildWithOptions_BETA(options);
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

  static create<T extends ConfirmEditEmailAddressActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      user: User,
      input: ConfirmEditEmailAddressInput,
    ) => T,
    viewer: ExampleViewerAlias,
    user: User,
    input: ConfirmEditEmailAddressInput,
  ): T {
    return new this(viewer, user, input);
  }

  static async saveXFromID<T extends ConfirmEditEmailAddressActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      user: User,
      input: ConfirmEditEmailAddressInput,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
    input: ConfirmEditEmailAddressInput,
  ): Promise<User> {
    const user = await User.loadX(viewer, id);
    return new this(viewer, user, input).saveX();
  }
}
