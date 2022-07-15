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

export interface UserEditInput {
  firstName?: string;
  lastName?: string;
}

export type EditUserActionTriggers = (
  | Trigger<
      User,
      UserBuilder<UserEditInput, User>,
      ExampleViewerAlias,
      UserEditInput,
      User
    >
  | Trigger<
      User,
      UserBuilder<UserEditInput, User>,
      ExampleViewerAlias,
      UserEditInput,
      User
    >[]
)[];

export type EditUserActionObservers = Observer<
  User,
  UserBuilder<UserEditInput, User>,
  ExampleViewerAlias,
  UserEditInput,
  User
>[];

export type EditUserActionValidators = Validator<
  User,
  UserBuilder<UserEditInput, User>,
  ExampleViewerAlias,
  UserEditInput,
  User
>[];

export class EditUserActionBase
  implements
    Action<
      User,
      UserBuilder<UserEditInput, User>,
      ExampleViewerAlias,
      UserEditInput,
      User
    >
{
  public readonly builder: UserBuilder<UserEditInput, User>;
  public readonly viewer: ExampleViewerAlias;
  protected input: UserEditInput;
  protected readonly user: User;

  constructor(viewer: ExampleViewerAlias, user: User, input: UserEditInput) {
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

  getTriggers(): EditUserActionTriggers {
    return [];
  }

  getObservers(): EditUserActionObservers {
    return [];
  }

  getValidators(): EditUserActionValidators {
    return [];
  }

  getInput(): UserEditInput {
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

  static create<T extends EditUserActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      user: User,
      input: UserEditInput,
    ) => T,
    viewer: ExampleViewerAlias,
    user: User,
    input: UserEditInput,
  ): T {
    return new this(viewer, user, input);
  }

  static async saveXFromID<T extends EditUserActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      user: User,
      input: UserEditInput,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
    input: UserEditInput,
  ): Promise<User> {
    const user = await User.loadX(viewer, id);
    return new this(viewer, user, input).saveX();
  }
}
