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
import { ExampleViewer } from "../../../../viewer/viewer";

export interface ContactEmailInput {
  emailAddress?: string;
  label?: string;
  contactID?: ID | Builder<Contact, ExampleViewer>;
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
> implements Builder<ContactEmail, ExampleViewer, TExistingEnt>
{
  orchestrator: Orchestrator<ContactEmail, TInput, ExampleViewer, TExistingEnt>;
  readonly placeholderID: ID;
  readonly ent = ContactEmail;
  readonly nodeType = NodeType.ContactEmail;
  private input: TInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: ExampleViewer,
    public readonly operation: WriteOperation,
    action: Action<
      ContactEmail,
      Builder<ContactEmail, ExampleViewer, TExistingEnt>,
      ExampleViewer,
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
  getNewEmailAddressValue(): string | undefined {
    if (this.input.emailAddress !== undefined) {
      return this.input.emailAddress;
    }
    return this.existingEnt?.emailAddress;
  }

  // get value of label. Retrieves it from the input if specified or takes it from existingEnt
  getNewLabelValue(): string | undefined {
    if (this.input.label !== undefined) {
      return this.input.label;
    }
    return this.existingEnt?.label;
  }

  // get value of contactID. Retrieves it from the input if specified or takes it from existingEnt
  getNewContactIDValue(): ID | Builder<Contact, ExampleViewer> | undefined {
    if (this.input.contactID !== undefined) {
      return this.input.contactID;
    }
    return this.existingEnt?.contactID;
  }
}
