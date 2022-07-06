// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Ent, ID, Viewer } from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  Orchestrator,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@snowtop/ent/action";
import { Account, AccountState } from "src/ent/";
import { NodeType } from "src/ent/generated/const";
import { accountLoaderInfo } from "src/ent/generated/loaders";
import schema from "src/schema/account_schema";

export interface AccountInput {
  deletedAt?: Date | null;
  name?: string;
  phoneNumber?: string;
  accountState?: AccountState | null;
  // allow other properties. useful for action-only fields
  [x: string]: any;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export class AccountBuilder<
  TInput extends AccountInput = AccountInput,
  TExistingEnt extends TMaybleNullableEnt<Account> = Account | null,
> implements Builder<Account, Viewer, TExistingEnt>
{
  orchestrator: Orchestrator<Account, TInput, Viewer, TExistingEnt>;
  readonly placeholderID: ID;
  readonly ent = Account;
  readonly nodeType = NodeType.Account;
  private input: TInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: Action<
      Account,
      Builder<Account, Viewer, TExistingEnt>,
      Viewer,
      TInput,
      TExistingEnt
    >,
    public readonly existingEnt: TExistingEnt,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Account`;
    this.input = action.getInput();
    const updateInput = (d: AccountInput) => this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "accounts",
      key: "id",
      loaderOptions: Account.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
      fieldInfo: accountLoaderInfo.fieldInfo,
    });
  }

  getInput(): TInput {
    return this.input;
  }

  updateInput(input: AccountInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  deleteInputKey(key: keyof AccountInput) {
    delete this.input[key];
  }

  // store data in Builder that can be retrieved by another validator, trigger, observer later in the action
  storeData(k: string, v: any) {
    this.m.set(k, v);
  }

  // retrieve data stored in this Builder with key
  getStoredData(k: string) {
    return this.m.get(k);
  }

  // this returns the id of the existing ent or the id of the ent that's being created
  async getEntID() {
    if (this.existingEnt) {
      return this.existingEnt.id;
    }
    const edited = await this.orchestrator.getEditedData();
    if (!edited.id) {
      throw new Error(
        `couldn't get the id field. should have been set by 'defaultValueOnCreate'`,
      );
    }
    return edited.id;
  }
  async build(): Promise<Changeset> {
    return this.orchestrator.build();
  }

  async valid(): Promise<boolean> {
    return this.orchestrator.valid();
  }

  async validX(): Promise<void> {
    return this.orchestrator.validX();
  }

  async save(): Promise<void> {
    await saveBuilder(this);
  }

  async saveX(): Promise<void> {
    await saveBuilderX(this);
  }

  async editedEnt(): Promise<Account | null> {
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Account> {
    return this.orchestrator.editedEntX();
  }

  private async getEditedFields(): Promise<Map<string, any>> {
    const fields = this.input;

    const result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("deleted_at", fields.deletedAt);
    addField("Name", fields.name);
    addField("PhoneNumber", fields.phoneNumber);
    addField("accountState", fields.accountState);
    return result;
  }

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }

  // get value of deleted_at. Retrieves it from the input if specified or takes it from existingEnt
  getNewDeletedAtValue(): Date | null | undefined {
    return this.input.deletedAt;
  }

  // get value of Name. Retrieves it from the input if specified or takes it from existingEnt
  getNewNameValue(): string {
    if (this.input.name !== undefined) {
      return this.input.name;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `name` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.name;
  }

  // get value of PhoneNumber. Retrieves it from the input if specified or takes it from existingEnt
  getNewPhoneNumberValue(): string | null {
    if (this.input.phoneNumber !== undefined) {
      return this.input.phoneNumber;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `phoneNumber` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.phoneNumber;
  }

  // get value of accountState. Retrieves it from the input if specified or takes it from existingEnt
  getNewAccountStateValue(): AccountState | null {
    if (this.input.accountState !== undefined) {
      return this.input.accountState;
    }

    return this.existingEnt?.accountState ?? null;
  }
}
