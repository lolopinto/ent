/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { Ent, ID } from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  Orchestrator,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@snowtop/ent/action";
import { AuthCode, User } from "../../..";
import { NodeType } from "../../const";
import { authCodeLoaderInfo } from "../../loaders";
import schema from "../../../../schema/auth_code_schema";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface AuthCodeInput {
  code?: string;
  userID?: ID | Builder<User, ExampleViewerAlias>;
  emailAddress?: string | null;
  phoneNumber?: string | null;
  // allow other properties. useful for action-only fields
  [x: string]: any;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export class AuthCodeBuilder<
  TInput extends AuthCodeInput = AuthCodeInput,
  TExistingEnt extends TMaybleNullableEnt<AuthCode> = AuthCode | null,
> implements Builder<AuthCode, ExampleViewerAlias, TExistingEnt>
{
  orchestrator: Orchestrator<
    AuthCode,
    TInput,
    ExampleViewerAlias,
    TExistingEnt
  >;
  readonly placeholderID: ID;
  readonly ent = AuthCode;
  readonly nodeType = NodeType.AuthCode;
  private input: TInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: ExampleViewerAlias,
    public readonly operation: WriteOperation,
    action: Action<
      AuthCode,
      Builder<AuthCode, ExampleViewerAlias, TExistingEnt>,
      ExampleViewerAlias,
      TInput,
      TExistingEnt
    >,
    public readonly existingEnt: TExistingEnt,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-AuthCode`;
    this.input = action.getInput();
    const updateInput = (d: AuthCodeInput) => this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "auth_codes",
      key: "id",
      loaderOptions: AuthCode.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
      fieldInfo: authCodeLoaderInfo.fieldInfo,
    });
  }

  getInput(): TInput {
    return this.input;
  }

  updateInput(input: AuthCodeInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  deleteInputKey(key: keyof AuthCodeInput) {
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

  async editedEnt(): Promise<AuthCode | null> {
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<AuthCode> {
    return this.orchestrator.editedEntX();
  }

  private async getEditedFields(): Promise<Map<string, any>> {
    const input = this.input;

    const result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("code", input.code);
    addField("userID", input.userID);
    addField("emailAddress", input.emailAddress);
    addField("phoneNumber", input.phoneNumber);
    return result;
  }

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }

  // get value of code. Retrieves it from the input if specified or takes it from existingEnt
  getNewCodeValue(): string {
    if (this.input.code !== undefined) {
      return this.input.code;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `code` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.code;
  }

  // get value of userID. Retrieves it from the input if specified or takes it from existingEnt
  getNewUserIDValue(): ID | Builder<User, ExampleViewerAlias> {
    if (this.input.userID !== undefined) {
      return this.input.userID;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `userID` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.userID;
  }

  // get value of emailAddress. Retrieves it from the input if specified or takes it from existingEnt
  getNewEmailAddressValue(): string | null {
    if (this.input.emailAddress !== undefined) {
      return this.input.emailAddress;
    }

    return this.existingEnt?.emailAddress ?? null;
  }

  // get value of phoneNumber. Retrieves it from the input if specified or takes it from existingEnt
  getNewPhoneNumberValue(): string | null {
    if (this.input.phoneNumber !== undefined) {
      return this.input.phoneNumber;
    }

    return this.existingEnt?.phoneNumber ?? null;
  }
}
