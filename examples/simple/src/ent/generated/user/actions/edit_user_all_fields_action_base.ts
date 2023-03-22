/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  Clause,
  ID,
  PrivacyPolicy,
} from "@snowtop/ent";
import {
  Action,
  Changeset,
  Observer,
  RelativeNumberValue,
  Trigger,
  Validator,
  WriteOperation,
  maybeConvertRelativeInputPlusExpressions,
} from "@snowtop/ent/action";
import { User } from "../../..";
import {
  UserAccountStatus,
  UserDaysOff,
  UserIntEnum,
  UserNestedObjectList,
  UserPreferredShift,
  UserPrefsDiff,
  UserPrefsStruct,
  UserPrefsStruct2,
  UserSuperNestedObject,
} from "../../types";
import { UserBuilder } from "./user_builder";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface EditUserAllFieldsRelativeInput {
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  phoneNumber?: string | null;
  accountStatus?: UserAccountStatus | null;
  emailVerified?: boolean;
  bio?: string | null;
  nicknames?: string[] | null;
  prefs?: UserPrefsStruct | null;
  prefsList?: UserPrefsStruct2[] | null;
  prefsDiff?: UserPrefsDiff | null;
  daysOff?: UserDaysOff[] | null;
  preferredShift?: UserPreferredShift[] | null;
  timeInMs?: BigInt | null | RelativeNumberValue<BigInt>;
  funUuids?: ID[] | null;
  superNestedObject?: UserSuperNestedObject | null;
  nestedList?: UserNestedObjectList[] | null;
  intEnum?: UserIntEnum | null;
}

export interface EditUserAllFieldsInput extends EditUserAllFieldsRelativeInput {
  timeInMs?: BigInt | null;
}

export type EditUserAllFieldsActionTriggers = (
  | Trigger<
      User,
      UserBuilder<EditUserAllFieldsInput, User>,
      ExampleViewerAlias,
      EditUserAllFieldsInput,
      User
    >
  | Trigger<
      User,
      UserBuilder<EditUserAllFieldsInput, User>,
      ExampleViewerAlias,
      EditUserAllFieldsInput,
      User
    >[]
)[];

export type EditUserAllFieldsActionObservers = Observer<
  User,
  UserBuilder<EditUserAllFieldsInput, User>,
  ExampleViewerAlias,
  EditUserAllFieldsInput,
  User
>[];

export type EditUserAllFieldsActionValidators = Validator<
  User,
  UserBuilder<EditUserAllFieldsInput, User>,
  ExampleViewerAlias,
  EditUserAllFieldsInput,
  User
>[];

export class EditUserAllFieldsActionBase
  implements
    Action<
      User,
      UserBuilder<EditUserAllFieldsInput, User>,
      ExampleViewerAlias,
      EditUserAllFieldsInput,
      User
    >
{
  public readonly builder: UserBuilder<EditUserAllFieldsInput, User>;
  public readonly viewer: ExampleViewerAlias;
  protected input: EditUserAllFieldsInput;
  protected readonly user: User;

  constructor(
    viewer: ExampleViewerAlias,
    user: User,
    input: EditUserAllFieldsRelativeInput,
  ) {
    this.viewer = viewer;
    let expressions = new Map<string, Clause>();
    const data = user.___getRawDBData();
    // @ts-expect-error converted below
    this.input = input;
    const timeInMs = maybeConvertRelativeInputPlusExpressions(
      input.timeInMs,
      "time_in_ms",
      data.time_in_ms,
      expressions,
    );
    if (timeInMs !== undefined) {
      input.timeInMs = timeInMs;
    }
    this.builder = new UserBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      user,
      { expressions },
    );
    this.user = user;
  }

  getPrivacyPolicy(): PrivacyPolicy<User, ExampleViewerAlias> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): EditUserAllFieldsActionTriggers {
    return [];
  }

  getObservers(): EditUserAllFieldsActionObservers {
    return [];
  }

  getValidators(): EditUserAllFieldsActionValidators {
    return [];
  }

  getInput(): EditUserAllFieldsInput {
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

  static create<T extends EditUserAllFieldsActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      user: User,
      input: EditUserAllFieldsRelativeInput,
    ) => T,
    viewer: ExampleViewerAlias,
    user: User,
    input: EditUserAllFieldsRelativeInput,
  ): T {
    return new this(viewer, user, input);
  }

  static async saveXFromID<T extends EditUserAllFieldsActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      user: User,
      input: EditUserAllFieldsRelativeInput,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
    input: EditUserAllFieldsInput,
  ): Promise<User> {
    const user = await User.loadX(viewer, id);
    return new this(viewer, user, input).saveX();
  }
}
