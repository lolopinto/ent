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
import schema from "src/schema/account";

export interface AccountInput {
  deletedAt?: Date | null;
  name?: string;
  phoneNumber?: string;
  accountState?: AccountState | null;
}

export interface AccountAction extends Action<Account> {
  getInput(): AccountInput;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class AccountBuilder implements Builder<Account> {
  orchestrator: Orchestrator<Account>;
  readonly placeholderID: ID;
  readonly ent = Account;
  readonly nodeType = NodeType.Account;
  private input: AccountInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: AccountAction,
    public readonly existingEnt?: Account | undefined,
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
    });
  }

  getInput(): AccountInput {
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

  async build(): Promise<Changeset<Account>> {
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

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of deleted_at. Retrieves it from the input if specified or takes it from existingEnt
  getNewDeletedAtValue(): Date | null | undefined {
    return this.input.deletedAt;
  }

  // get value of Name. Retrieves it from the input if specified or takes it from existingEnt
  getNewNameValue(): string | undefined {
    if (this.input.name !== undefined) {
      return this.input.name;
    }
    return this.existingEnt?.name;
  }

  // get value of PhoneNumber. Retrieves it from the input if specified or takes it from existingEnt
  getNewPhoneNumberValue(): string | null | undefined {
    if (this.input.phoneNumber !== undefined) {
      return this.input.phoneNumber;
    }
    return this.existingEnt?.phoneNumber;
  }

  // get value of accountState. Retrieves it from the input if specified or takes it from existingEnt
  getNewAccountStateValue(): AccountState | null | undefined {
    if (this.input.accountState !== undefined) {
      return this.input.accountState;
    }
    return this.existingEnt?.accountState;
  }
}
