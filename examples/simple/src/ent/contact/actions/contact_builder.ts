// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Ent, ID, Viewer } from "@snowtop/snowtop-ts";
import {
  Action,
  Builder,
  Changeset,
  Orchestrator,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@snowtop/snowtop-ts/action";
import { Contact, User } from "src/ent/";
import schema from "src/schema/contact";

export interface ContactInput {
  emailAddress?: string;
  firstName?: string;
  lastName?: string;
  userID?: ID | Builder<User>;
}

export interface ContactAction extends Action<Contact> {
  getInput(): ContactInput;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class ContactBuilder implements Builder<Contact> {
  orchestrator: Orchestrator<Contact>;
  readonly placeholderID: ID;
  readonly ent = Contact;
  private input: ContactInput;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: ContactAction,
    public readonly existingEnt?: Contact | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Contact`;
    this.input = action.getInput();

    this.orchestrator = new Orchestrator({
      viewer: viewer,
      operation: this.operation,
      tableName: "contacts",
      key: "id",
      loaderOptions: Contact.loaderOptions(),
      builder: this,
      action: action,
      schema: schema,
      editedFields: () => {
        return this.getEditedFields.apply(this);
      },
    });
  }

  getInput(): ContactInput {
    return this.input;
  }

  updateInput(input: ContactInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  async build(): Promise<Changeset<Contact>> {
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

  async editedEnt(): Promise<Contact | null> {
    return await this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Contact> {
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
    addField("emailAddress", fields.emailAddress);
    addField("firstName", fields.firstName);
    addField("lastName", fields.lastName);
    addField("userID", fields.userID);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of emailAddress. Retrieves it from the input if specified or takes it from existingEnt
  getNewEmailAddressValue(): string | undefined {
    return this.input.emailAddress || this.existingEnt?.emailAddress;
  }

  // get value of firstName. Retrieves it from the input if specified or takes it from existingEnt
  getNewFirstNameValue(): string | undefined {
    return this.input.firstName || this.existingEnt?.firstName;
  }

  // get value of lastName. Retrieves it from the input if specified or takes it from existingEnt
  getNewLastNameValue(): string | undefined {
    return this.input.lastName || this.existingEnt?.lastName;
  }

  // get value of userID. Retrieves it from the input if specified or takes it from existingEnt
  getNewUserIDValue(): ID | Builder<User> | undefined {
    return this.input.userID || this.existingEnt?.userID;
  }
}
