// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  Viewer,
  ID,
  AllowIfViewerHasIdentityPrivacyPolicy,
  PrivacyPolicy,
} from "@lolopinto/ent";
import {
  Action,
  Builder,
  WriteOperation,
  Changeset,
} from "@lolopinto/ent/action";
import { AuthCode, User } from "src/ent/";
import {
  AuthCodeBuilder,
  AuthCodeInput,
} from "src/ent/auth_code/actions/auth_code_builder";

export interface AuthCodeCreateInput {
  code: string;
  userID: ID | Builder<User>;
  emailAddress?: string | null;
  phoneNumber?: string | null;
}

export class CreateAuthCodeActionBase implements Action<AuthCode> {
  public readonly builder: AuthCodeBuilder;
  public readonly viewer: Viewer;
  protected input: AuthCodeCreateInput;

  constructor(viewer: Viewer, input: AuthCodeCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new AuthCodeBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): AuthCodeInput {
    return this.input;
  }

  async changeset(): Promise<Changeset<AuthCode>> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<AuthCode | null> {
    await this.builder.save();
    return await this.builder.editedEnt();
  }

  async saveX(): Promise<AuthCode> {
    await this.builder.saveX();
    return await this.builder.editedEntX();
  }

  static create<T extends CreateAuthCodeActionBase>(
    this: new (viewer: Viewer, input: AuthCodeCreateInput) => T,
    viewer: Viewer,
    input: AuthCodeCreateInput,
  ): CreateAuthCodeActionBase {
    return new this(viewer, input);
  }
}
