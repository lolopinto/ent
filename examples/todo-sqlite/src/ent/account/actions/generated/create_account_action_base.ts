// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { Account } from "src/ent/";
import { AccountBuilder } from "src/ent/account/actions/generated/account_builder";

export interface AccountCreateInput {
  name: string;
  phoneNumber: string;
}

export class CreateAccountActionBase
  implements
    Action<Account, AccountBuilder<AccountCreateInput>, AccountCreateInput>
{
  public readonly builder: AccountBuilder<AccountCreateInput>;
  public readonly viewer: Viewer;
  protected input: AccountCreateInput;

  constructor(viewer: Viewer, input: AccountCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new AccountBuilder(this.viewer, WriteOperation.Insert, this);
  }

  getPrivacyPolicy(): PrivacyPolicy<Account> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): AccountCreateInput {
    return this.input;
  }

  async changeset(): Promise<Changeset<Account>> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<Account | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Account> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends CreateAccountActionBase>(
    this: new (viewer: Viewer, input: AccountCreateInput) => T,
    viewer: Viewer,
    input: AccountCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
