// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Ent, ID, Viewer } from "@lolopinto/ent";
import {
  Action,
  Builder,
  Changeset,
  Orchestrator,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@lolopinto/ent/action";
import { Account } from "src/ent/";
import schema from "src/schema/account";

export interface AccountInput {
  name?: string;
  phoneNumber?: string;
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
  private input: AccountInput;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: AccountAction,
    public readonly existingEnt?: Account | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Account`;
    this.input = action.getInput();

    this.orchestrator = new Orchestrator({
      viewer: viewer,
      operation: this.operation,
      tableName: "accounts",
      key: "id",
      loaderOptions: Account.loaderOptions(),
      builder: this,
      action: action,
      schema: schema,
      editedFields: () => {
        return this.getEditedFields.apply(this);
      },
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
    return await this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Account> {
    return await this.orchestrator.editedEntX();
  }

  private getEditedFields(): Map<string, any> {
    const fields = this.input;

    let result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("Name", fields.name);
    addField("PhoneNumber", fields.phoneNumber);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of Name. Retrieves it from the input if specified or takes it from existingEnt
  getNewNameValue(): string | undefined {
    return this.input.name || this.existingEnt?.name;
  }

  // get value of PhoneNumber. Retrieves it from the input if specified or takes it from existingEnt
  getNewPhoneNumberValue(): string | undefined {
    return this.input.phoneNumber || this.existingEnt?.phoneNumber;
  }
}
