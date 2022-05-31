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
  Builder,
  Changeset,
  WriteOperation,
} from "@snowtop/ent/action";
import { AuthCode, User } from "../../..";
import { AuthCodeBuilder } from "./auth_code_builder";
import { ExampleViewer } from "../../../../viewer/viewer";

export interface AuthCodeCreateInput {
  code: string;
  userID: ID | Builder<User, ExampleViewer>;
  emailAddress?: string | null;
  phoneNumber?: string | null;
}

export class CreateAuthCodeActionBase
  implements
    Action<
      AuthCode,
      AuthCodeBuilder<AuthCodeCreateInput, AuthCode | null>,
      ExampleViewer,
      AuthCodeCreateInput,
      AuthCode | null
    >
{
  public readonly builder: AuthCodeBuilder<
    AuthCodeCreateInput,
    AuthCode | null
  >;
  public readonly viewer: ExampleViewer;
  protected input: AuthCodeCreateInput;

  constructor(viewer: ExampleViewer, input: AuthCodeCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new AuthCodeBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
      null,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy<AuthCode> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): AuthCodeCreateInput {
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

  async save(): Promise<AuthCode | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<AuthCode> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends CreateAuthCodeActionBase>(
    this: new (viewer: ExampleViewer, input: AuthCodeCreateInput) => T,
    viewer: ExampleViewer,
    input: AuthCodeCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
