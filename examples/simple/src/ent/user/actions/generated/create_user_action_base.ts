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
import { DaysOff, PreferredShift, User } from "../../..";
import { UserPrefsStruct } from "../../../generated/user_prefs_struct";
import { UserPrefsStruct2 } from "../../../generated/user_prefs_struct_2";
import { UserBuilder } from "./user_builder";

export interface UserCreateInput {
  firstName: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string;
  password: string;
  nicknames?: string[] | null;
  prefs?: UserPrefsStruct | null;
  prefsDiff?: any;
  daysOff?: DaysOff[] | null;
  preferredShift?: PreferredShift[] | null;
  funUuids?: ID[] | null;
  prefsList?: UserPrefsStruct2[] | null;
}

export class CreateUserActionBase
  implements Action<User, UserBuilder<UserCreateInput>, UserCreateInput>
{
  public readonly builder: UserBuilder<UserCreateInput>;
  public readonly viewer: Viewer;
  protected input: UserCreateInput;

  constructor(viewer: Viewer, input: UserCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new UserBuilder(this.viewer, WriteOperation.Insert, this);
  }

  getPrivacyPolicy(): PrivacyPolicy<User> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): UserCreateInput {
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

  static create<T extends CreateUserActionBase>(
    this: new (viewer: Viewer, input: UserCreateInput) => T,
    viewer: Viewer,
    input: UserCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
