// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
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
import { Account } from "src/ent/";
import { AccountBuilder } from "src/ent/generated/account/actions/account_builder";
import { AccountPrefs, AccountState } from "src/ent/generated/types";

export interface AccountEditInput {
  name?: string;
  phoneNumber?: string;
  accountState?: AccountState | null;
  accountPrefs?: AccountPrefs | null;
  accountPrefs3?: AccountPrefs;
  accountPrefsList?: AccountPrefs[] | null;
}

export type EditAccountActionTriggers = (
  | Trigger<
      Account,
      AccountBuilder<AccountEditInput, Account>,
      Viewer,
      AccountEditInput,
      Account
    >
  | Trigger<
      Account,
      AccountBuilder<AccountEditInput, Account>,
      Viewer,
      AccountEditInput,
      Account
    >[]
)[];

export type EditAccountActionObservers = Observer<
  Account,
  AccountBuilder<AccountEditInput, Account>,
  Viewer,
  AccountEditInput,
  Account
>[];

export type EditAccountActionValidators = Validator<
  Account,
  AccountBuilder<AccountEditInput, Account>,
  Viewer,
  AccountEditInput,
  Account
>[];

export class EditAccountActionBase
  implements
    Action<
      Account,
      AccountBuilder<AccountEditInput, Account>,
      Viewer,
      AccountEditInput,
      Account
    >
{
  public readonly builder: AccountBuilder<AccountEditInput, Account>;
  public readonly viewer: Viewer;
  protected input: AccountEditInput;
  protected readonly account: Account;

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

  getPrivacyPolicy(): PrivacyPolicy<Account, Viewer> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): EditAccountActionTriggers {
    return [];
  }

  getObservers(): EditAccountActionObservers {
    return [];
  }

  getValidators(): EditAccountActionValidators {
    return [];
  }

  getInput(): AccountEditInput {
    return this.input;
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

  async save(): Promise<Account | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Account> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends EditAccountActionBase>(
    this: new (
      viewer: Viewer,
      account: Account,
      input: AccountEditInput,
    ) => T,
    viewer: Viewer,
    account: Account,
    input: AccountEditInput,
  ): T {
    return new this(viewer, account, input);
  }

  static async saveXFromID<T extends EditAccountActionBase>(
    this: new (
      viewer: Viewer,
      account: Account,
      input: AccountEditInput,
    ) => T,
    viewer: Viewer,
    id: ID,
    input: AccountEditInput,
  ): Promise<Account> {
    const account = await Account.loadX(viewer, id);
    return new this(viewer, account, input).saveX();
  }
}
