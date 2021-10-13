// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { Account } from "src/ent/";
import {
  AccountBuilder,
  AccountInput,
} from "src/ent/account/actions/generated/account_builder";

export interface AccountEditInput {
  name?: string;
  phoneNumber?: string;
}

export class EditAccountActionBase implements Action<Account> {
  public readonly builder: AccountBuilder;
  public readonly viewer: Viewer;
  protected input: AccountEditInput;
  protected account: Account;

  constructor(viewer: Viewer, account: Account, input: AccountEditInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new AccountBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      account,
    );
    this.account = account;
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): AccountInput {
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

  static create<T extends EditAccountActionBase>(
    this: new (viewer: Viewer, account: Account, input: AccountEditInput) => T,
    viewer: Viewer,
    account: Account,
    input: AccountEditInput,
  ): EditAccountActionBase {
    return new this(viewer, account, input);
  }

  static async saveXFromID<T extends EditAccountActionBase>(
    this: new (viewer: Viewer, account: Account, input: AccountEditInput) => T,
    viewer: Viewer,
    id: ID,
    input: AccountEditInput,
  ): Promise<Account> {
    const account = await Account.loadX(viewer, id);
    return new this(viewer, account, input).saveX();
  }
}
