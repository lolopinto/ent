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
import { AuthCode } from "../../..";
import { AuthCodeBuilder, AuthCodeInput } from "./auth_code_builder";

export class DeleteAuthCodeActionBase implements Action<AuthCode> {
  public readonly builder: AuthCodeBuilder;
  public readonly viewer: Viewer;
  protected authCode: AuthCode;

  constructor(viewer: Viewer, authCode: AuthCode) {
    this.viewer = viewer;
    this.builder = new AuthCodeBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      authCode,
    );
    this.authCode = authCode;
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): AuthCodeInput {
    return {};
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

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  static create<T extends DeleteAuthCodeActionBase>(
    this: new (viewer: Viewer, authCode: AuthCode) => T,
    viewer: Viewer,
    authCode: AuthCode,
  ): DeleteAuthCodeActionBase {
    return new this(viewer, authCode);
  }

  static async saveXFromID<T extends DeleteAuthCodeActionBase>(
    this: new (viewer: Viewer, authCode: AuthCode) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    const authCode = await AuthCode.loadX(viewer, id);
    return new this(viewer, authCode).saveX();
  }
}
