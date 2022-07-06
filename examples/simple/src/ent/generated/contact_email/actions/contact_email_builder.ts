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
import { Contact, ContactEmail } from "../../..";
import { NodeType } from "../../const";
import { contactEmailLoaderInfo } from "../../loaders";
import schema from "../../../../schema/contact_email_schema";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface ContactEmailInput {
  emailAddress?: string;
  label?: string;
  contactID?: ID | Builder<Contact, ExampleViewerAlias>;
  // allow other properties. useful for action-only fields
  [x: string]: any;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export class ContactEmailBuilder<
  TInput extends ContactEmailInput = ContactEmailInput,
  TExistingEnt extends TMaybleNullableEnt<ContactEmail> = ContactEmail | null,
> implements Builder<ContactEmail, ExampleViewerAlias, TExistingEnt>
{
  orchestrator: Orchestrator<
    ContactEmail,
    TInput,
    ExampleViewerAlias,
    TExistingEnt
  >;
  readonly placeholderID: ID;
  readonly ent = ContactEmail;
  readonly nodeType = NodeType.ContactEmail;
  private input: TInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: ExampleViewerAlias,
    public readonly operation: WriteOperation,
    action: Action<
      ContactEmail,
      Builder<ContactEmail, ExampleViewerAlias, TExistingEnt>,
      ExampleViewerAlias,
      TInput,
      TExistingEnt
    >,
    public readonly existingEnt: TExistingEnt,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-ContactEmail`;
    this.input = action.getInput();
    const updateInput = (d: ContactEmailInput) =>
      this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "contact_emails",
      key: "id",
      loaderOptions: ContactEmail.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
      fieldInfo: contactEmailLoaderInfo.fieldInfo,
    });
  }

  getInput(): TInput {
    return this.input;
  }

  updateInput(input: ContactEmailInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  deleteInputKey(key: keyof ContactEmailInput) {
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

  async editedEnt(): Promise<ContactEmail | null> {
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<ContactEmail> {
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
    addField("emailAddress", fields.emailAddress);
    addField("label", fields.label);
    addField("contactID", fields.contactID);
    return result;
  }

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }

  // get value of emailAddress. Retrieves it from the input if specified or takes it from existingEnt
  getNewEmailAddressValue(): string {
    if (this.input.emailAddress !== undefined) {
      return this.input.emailAddress;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `emailAddress` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.emailAddress;
  }

  // get value of label. Retrieves it from the input if specified or takes it from existingEnt
  getNewLabelValue(): string {
    if (this.input.label !== undefined) {
      return this.input.label;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `label` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.label;
  }

  // get value of contactID. Retrieves it from the input if specified or takes it from existingEnt
  getNewContactIDValue(): ID | Builder<Contact, ExampleViewerAlias> {
    if (this.input.contactID !== undefined) {
      return this.input.contactID;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `contactID` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.contactID;
  }
}
