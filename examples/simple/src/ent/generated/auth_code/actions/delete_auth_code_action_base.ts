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
import { AuthCode } from "../../..";
import { AuthCodeBuilder, AuthCodeInput } from "./auth_code_builder";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export type DeleteAuthCodeActionTriggers = (
  | Trigger<
      AuthCode,
      AuthCodeBuilder<AuthCodeInput, AuthCode>,
      ExampleViewerAlias,
      AuthCodeInput,
      AuthCode
    >
  | Trigger<
      AuthCode,
      AuthCodeBuilder<AuthCodeInput, AuthCode>,
      ExampleViewerAlias,
      AuthCodeInput,
      AuthCode
    >[]
)[];

export type DeleteAuthCodeActionObservers = Observer<
  AuthCode,
  AuthCodeBuilder<AuthCodeInput, AuthCode>,
  ExampleViewerAlias,
  AuthCodeInput,
  AuthCode
>[];

export type DeleteAuthCodeActionValidators = Validator<
  AuthCode,
  AuthCodeBuilder<AuthCodeInput, AuthCode>,
  ExampleViewerAlias,
  AuthCodeInput,
  AuthCode
>[];

export class DeleteAuthCodeActionBase
  implements
    Action<
      AuthCode,
      AuthCodeBuilder<AuthCodeInput, AuthCode>,
      ExampleViewerAlias,
      AuthCodeInput,
      AuthCode
    >
{
  public readonly builder: AuthCodeBuilder<AuthCodeInput, AuthCode>;
  public readonly viewer: ExampleViewerAlias;
  protected readonly authCode: AuthCode;

  constructor(viewer: ExampleViewerAlias, authCode: AuthCode) {
    this.viewer = viewer;
    this.builder = new AuthCodeBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      authCode,
    );
    this.authCode = authCode;
  }

  getPrivacyPolicy(): PrivacyPolicy<AuthCode, ExampleViewerAlias> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): DeleteAuthCodeActionTriggers {
    return [];
  }

  getObservers(): DeleteAuthCodeActionObservers {
    return [];
  }

  getValidators(): DeleteAuthCodeActionValidators {
    return [];
  }

  getInput(): AuthCodeInput {
    return {};
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

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  static create<T extends DeleteAuthCodeActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      authCode: AuthCode,
    ) => T,
    viewer: ExampleViewerAlias,
    authCode: AuthCode,
  ): T {
    return new this(viewer, authCode);
  }

  static async saveXFromID<T extends DeleteAuthCodeActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      authCode: AuthCode,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
  ): Promise<void> {
    const authCode = await AuthCode.loadX(viewer, id);
    return new this(viewer, authCode).saveX();
  }
}
