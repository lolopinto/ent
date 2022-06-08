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
import { ExampleViewer } from "../../../../viewer/viewer";

export interface EditPhoneNumberInput {
  newPhoneNumber: string;
}

export class EditPhoneNumberActionBase
  implements
    Action<
      User,
      UserBuilder<EditPhoneNumberInput, User>,
      ExampleViewer,
      EditPhoneNumberInput,
      User
    >
{
  public readonly builder: UserBuilder<EditPhoneNumberInput, User>;
  public readonly viewer: ExampleViewer;
  protected input: EditPhoneNumberInput;
  protected readonly user: User;

  constructor(viewer: ExampleViewer, user: User, input: EditPhoneNumberInput) {
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

  getTriggers(): Trigger<
    User,
    UserBuilder<EditPhoneNumberInput, User>,
    ExampleViewer,
    EditPhoneNumberInput,
    User
  >[] {
    return [];
  }

  getObservers(): Observer<
    User,
    UserBuilder<EditPhoneNumberInput, User>,
    ExampleViewer,
    EditPhoneNumberInput,
    User
  >[] {
    return [];
  }

  getValidators(): Validator<
    User,
    UserBuilder<EditPhoneNumberInput, User>,
    ExampleViewer,
    EditPhoneNumberInput,
    User
  >[] {
    return [];
  }

  getInput(): EditPhoneNumberInput {
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

  static create<T extends EditPhoneNumberActionBase>(
    this: new (
      viewer: ExampleViewer,
      user: User,
      input: EditPhoneNumberInput,
    ) => T,
    viewer: ExampleViewer,
    user: User,
    input: EditPhoneNumberInput,
  ): T {
    return new this(viewer, user, input);
  }

  static async saveXFromID<T extends EditPhoneNumberActionBase>(
    this: new (
      viewer: ExampleViewer,
      user: User,
      input: EditPhoneNumberInput,
    ) => T,
    viewer: ExampleViewer,
    id: ID,
    input: EditPhoneNumberInput,
  ): Promise<User> {
    const user = await User.loadX(viewer, id);
    return new this(viewer, user, input).saveX();
  }
}
