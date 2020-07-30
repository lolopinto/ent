// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Viewer, ID } from "@lolopinto/ent";
import {
  Action,
  Builder,
  WriteOperation,
  Changeset,
  saveBuilder,
  saveBuilderX,
  Orchestrator,
} from "@lolopinto/ent/action";
import schema from "src/schema/contact";
import Contact from "src/ent/contact";
import User from "src/ent/user";

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
  return Math.random()
    .toString(10)
    .substring(2);
}

export class ContactBuilder implements Builder<Contact> {
  private orchestrator: Orchestrator<Contact>;
  readonly placeholderID: ID;
  readonly ent = Contact;
  private input: ContactInput;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    private action: ContactAction,
    public readonly existingEnt?: Contact | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}`;
    this.input = action.getInput();

    this.orchestrator = new Orchestrator({
      viewer: viewer,
      operation: this.operation,
      tableName: "contacts",
      ent: Contact,
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

    const addField = function(key: string, value: any) {
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

  private isUserBuilder(
    node: ID | User | Builder<User>,
  ): node is Builder<User> {
    return (node as Builder<User>).placeholderID !== undefined;
  }
}
