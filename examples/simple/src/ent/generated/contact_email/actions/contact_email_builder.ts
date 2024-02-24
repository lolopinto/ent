/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { Ent, ID } from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  ChangesetOptions,
  Orchestrator,
  OrchestratorOptions,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@snowtop/ent/action";
import { Contact, ContactEmail } from "../../..";
import { contactEmailLoaderInfo } from "../../loaders";
import { FeedbackBuilder } from "../../mixins/feedback/actions/feedback_builder";
import { ContactInfo, ContactLabel, EdgeType, NodeType } from "../../types";
import schema from "../../../../schema/contact_email_schema";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface ContactEmailInput {
  extra?: ContactInfo | null;
  emailAddress?: string;
  label?: ContactLabel;
  contactId?: ID | Builder<Contact, ExampleViewerAlias>;
  // allow other properties. useful for action-only fields
  [x: string]: any;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

class Base {
  // @ts-ignore not assigning. need for Mixin
  orchestrator: Orchestrator<ContactEmail, any, ExampleViewerAlias>;

  constructor() {}

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }
}

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export class ContactEmailBuilder<
    TInput extends ContactEmailInput = ContactEmailInput,
    TExistingEnt extends TMaybleNullableEnt<ContactEmail> = ContactEmail | null,
  >
  extends FeedbackBuilder(Base)
  implements Builder<ContactEmail, ExampleViewerAlias, TExistingEnt>
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
    opts?: Partial<
      OrchestratorOptions<
        ContactEmail,
        TInput,
        ExampleViewerAlias,
        TExistingEnt
      >
    >,
  ) {
    super();
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
      ...opts,
    });
  }

  getInput(): TInput {
    return this.input;
  }

  updateInput(input: Omit<ContactEmailInput, "contactId">) {
    if (input.contactId !== undefined) {
      throw new Error(
        `contactId cannot be passed to updateInput. use overrideContactId instead`,
      );
    }

    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  // override immutable field `contactId`
  overrideContactId(val: ID | Builder<Contact, ExampleViewerAlias>) {
    this.input.contactId = val;
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
  // this gets the inputs that have been written for a given edgeType and operation
  // WriteOperation.Insert for adding an edge and WriteOperation.Delete for deleting an edge
  getEdgeInputData(edgeType: EdgeType, op: WriteOperation) {
    return this.orchestrator.getInputEdges(edgeType, op);
  }

  clearInputEdges(edgeType: EdgeType, op: WriteOperation, id?: ID) {
    this.orchestrator.clearInputEdges(edgeType, op, id);
  }

  async build(): Promise<Changeset> {
    return this.orchestrator.build();
  }

  async buildWithOptions_BETA(options: ChangesetOptions): Promise<Changeset> {
    return this.orchestrator.buildWithOptions_BETA(options);
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
    const input = this.input;

    const result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("extra", input.extra);
    addField("emailAddress", input.emailAddress);
    addField("label", input.label);
    addField("contactID", input.contactId);
    return result;
  }

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }

  // get value of extra. Retrieves it from the input if specified or takes it from existingEnt
  getNewExtraValue(): ContactInfo | null {
    if (this.input.extra !== undefined) {
      return this.input.extra;
    }

    return this.existingEnt?.extra ?? null;
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
  getNewLabelValue(): ContactLabel {
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
  getNewContactIdValue(): ID | Builder<Contact, ExampleViewerAlias> {
    if (this.input.contactId !== undefined) {
      return this.input.contactId;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `contactId` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.contactId;
  }
}
