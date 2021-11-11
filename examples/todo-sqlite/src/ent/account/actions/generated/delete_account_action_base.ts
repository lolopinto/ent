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

export class DeleteAccountActionBase
  implements Action<Account, AccountBuilder<AccountInput>, AccountInput>
{
  public readonly builder: AccountBuilder<AccountInput>;
  public readonly viewer: Viewer;
  protected account: Account;

  constructor(viewer: Viewer, account: Account) {
    this.viewer = viewer;
    this.builder = new AccountBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      account,
    );
    this.account = account;
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): AccountInput {
    return {};
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

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  static create<T extends DeleteAccountActionBase>(
    this: new (viewer: Viewer, account: Account) => T,
    viewer: Viewer,
    account: Account,
  ): T {
    return new this(viewer, account);
  }

  static async saveXFromID<T extends DeleteAccountActionBase>(
    this: new (viewer: Viewer, account: Account) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    const account = await Account.loadX(viewer, id);
    return new this(viewer, account).saveX();
  }
}
