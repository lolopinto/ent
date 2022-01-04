/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { AssocEdgeInputOptions, Ent, ID, Viewer } from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  Orchestrator,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@snowtop/ent/action";
import { Comment, Contact, User } from "../../..";
import { EdgeType, NodeType } from "../../../generated/const";
import schema from "../../../../schema/contact";

export interface ContactInput {
  emailIds?: ID[];
  phoneNumberIds?: ID[];
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
  readonly nodeType = NodeType.Contact;
  private input: ContactInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: ContactAction,
    public readonly existingEnt?: Contact | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Contact`;
    this.input = action.getInput();
    const updateInput = (d: ContactInput) => this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "contacts",
      key: "id",
      loaderOptions: Contact.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
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

  // store data in Builder that can be retrieved by another validator, trigger, observer later in the action
  storeData(k: string, v: any) {
    this.m.set(k, v);
  }

  // retrieve data stored in this Builder with key
  getStoredData(k: string) {
    return this.m.get(k);
  }

  // this gets the inputs that have been written for a given edgeType and operation
  // WriteOperation.Insert for adding an edge and WriteOperation.Delete for deleting an edge
  getEdgeInputData(edgeType: EdgeType, op: WriteOperation) {
    return this.orchestrator.getInputEdges(edgeType, op);
  }

  clearInputEdges(edgeType: EdgeType, op: WriteOperation, id?: ID) {
    this.orchestrator.clearInputEdges(edgeType, op, id);
  }

  addComment(...nodes: (ID | Comment | Builder<Comment>)[]): ContactBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addCommentID(node);
      } else if (typeof node === "object") {
        this.addCommentID(node.id);
      } else {
        this.addCommentID(node);
      }
    }
    return this;
  }

  addCommentID(
    id: ID | Builder<Comment>,
    options?: AssocEdgeInputOptions,
  ): ContactBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.ObjectToComments,
      NodeType.Comment,
      options,
    );
    return this;
  }

  removeComment(...nodes: (ID | Comment)[]): ContactBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.ObjectToComments,
        );
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.ObjectToComments);
      }
    }
    return this;
  }

  addLiker(...nodes: (ID | User | Builder<User>)[]): ContactBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addLikerID(node);
      } else if (typeof node === "object") {
        this.addLikerID(node.id);
      } else {
        this.addLikerID(node);
      }
    }
    return this;
  }

  addLikerID(
    id: ID | Builder<User>,
    options?: AssocEdgeInputOptions,
  ): ContactBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.ObjectToLikers,
      NodeType.User,
      options,
    );
    return this;
  }

  removeLiker(...nodes: (ID | User)[]): ContactBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.ObjectToLikers);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.ObjectToLikers);
      }
    }
    return this;
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
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Contact> {
    return this.orchestrator.editedEntX();
  }

  private getEditedFields(): Map<string, any> {
    const fields = this.input;

    const result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("email_ids", fields.emailIds);
    addField("phone_number_ids", fields.phoneNumberIds);
    addField("firstName", fields.firstName);
    addField("lastName", fields.lastName);
    addField("userID", fields.userID);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of email_ids. Retrieves it from the input if specified or takes it from existingEnt
  getNewEmailIdsValue(): ID[] | undefined {
    if (this.input.emailIds !== undefined) {
      return this.input.emailIds;
    }
    return this.existingEnt?.emailIds;
  }

  // get value of phone_number_ids. Retrieves it from the input if specified or takes it from existingEnt
  getNewPhoneNumberIdsValue(): ID[] | undefined {
    if (this.input.phoneNumberIds !== undefined) {
      return this.input.phoneNumberIds;
    }
    return this.existingEnt?.phoneNumberIds;
  }

  // get value of firstName. Retrieves it from the input if specified or takes it from existingEnt
  getNewFirstNameValue(): string | undefined {
    if (this.input.firstName !== undefined) {
      return this.input.firstName;
    }
    return this.existingEnt?.firstName;
  }

  // get value of lastName. Retrieves it from the input if specified or takes it from existingEnt
  getNewLastNameValue(): string | undefined {
    if (this.input.lastName !== undefined) {
      return this.input.lastName;
    }
    return this.existingEnt?.lastName;
  }

  // get value of userID. Retrieves it from the input if specified or takes it from existingEnt
  getNewUserIDValue(): ID | Builder<User> | undefined {
    if (this.input.userID !== undefined) {
      return this.input.userID;
    }
    return this.existingEnt?.userID;
  }
}
