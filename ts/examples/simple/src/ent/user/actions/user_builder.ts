// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Viewer, ID, Ent, AssocEdgeInputOptions } from "@lolopinto/ent";
import {
  Action,
  Builder,
  WriteOperation,
  Changeset,
  saveBuilder,
  saveBuilderX,
  Orchestrator,
} from "@lolopinto/ent/action";
import schema from "src/schema/user";
import { EdgeType, NodeType } from "src/ent/const";
import { User, Event, Contact } from "src/ent/";

export interface UserInput {
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  phoneNumber?: string | null;
  password?: string | null;
  accountStatus?: string | null;
  emailVerified?: boolean;
}

export interface UserAction extends Action<User> {
  getInput(): UserInput;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class UserBuilder implements Builder<User> {
  private orchestrator: Orchestrator<User>;
  readonly placeholderID: ID;
  readonly ent = User;
  private input: UserInput;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    private action: UserAction,
    public readonly existingEnt?: User | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}`;
    this.input = action.getInput();

    this.orchestrator = new Orchestrator({
      viewer: viewer,
      operation: this.operation,
      tableName: "users",
      ent: User,
      builder: this,
      action: action,
      schema: schema,
      editedFields: () => {
        return this.getEditedFields.apply(this);
      },
    });
  }

  getInput(): UserInput {
    return this.input;
  }

  updateInput(input: UserInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  // this gets the inputs that have been written for a given edgeType and operation
  // WriteOperation.Insert for adding an edge and WriteOperation.Delete for deleting an edge
  getEdgeInputData(edgeType: EdgeType, op: WriteOperation) {
    return this.orchestrator.getInputEdges(edgeType, op);
  }

  clearInputEdges(edgeType: EdgeType, op: WriteOperation, id?: ID) {
    this.orchestrator.clearInputEdges(edgeType, op, id);
  }

  addCreatedEvent(...ids: ID[]): UserBuilder;
  addCreatedEvent(...nodes: Event[]): UserBuilder;
  addCreatedEvent(...nodes: Builder<Event>[]): UserBuilder;
  addCreatedEvent(...nodes: ID[] | Event[] | Builder<Event>[]): UserBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addCreatedEventID(node);
      } else if (typeof node === "object") {
        this.addCreatedEventID(node.id);
      } else {
        this.addCreatedEventID(node);
      }
    }
    return this;
  }

  addCreatedEventID(
    id: ID | Builder<Event>,
    options?: AssocEdgeInputOptions,
  ): UserBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.UserToCreatedEvents,
      NodeType.Event,
      options,
    );
    return this;
  }

  removeCreatedEvent(...ids: ID[]): UserBuilder;
  removeCreatedEvent(...nodes: Event[]): UserBuilder;
  removeCreatedEvent(...nodes: ID[] | Event[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.UserToCreatedEvents,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.UserToCreatedEvents,
        );
      }
    }
    return this;
  }

  addFriend(...ids: ID[]): UserBuilder;
  addFriend(...nodes: User[]): UserBuilder;
  addFriend(...nodes: Builder<User>[]): UserBuilder;
  addFriend(...nodes: ID[] | User[] | Builder<User>[]): UserBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addFriendID(node);
      } else if (typeof node === "object") {
        this.addFriendID(node.id);
      } else {
        this.addFriendID(node);
      }
    }
    return this;
  }

  addFriendID(
    id: ID | Builder<User>,
    options?: AssocEdgeInputOptions,
  ): UserBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.UserToFriends,
      NodeType.User,
      options,
    );
    return this;
  }

  removeFriend(...ids: ID[]): UserBuilder;
  removeFriend(...nodes: User[]): UserBuilder;
  removeFriend(...nodes: ID[] | User[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.UserToFriends);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.UserToFriends);
      }
    }
    return this;
  }

  addSelfContact(...ids: ID[]): UserBuilder;
  addSelfContact(...nodes: Contact[]): UserBuilder;
  addSelfContact(...nodes: Builder<Contact>[]): UserBuilder;
  addSelfContact(...nodes: ID[] | Contact[] | Builder<Contact>[]): UserBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addSelfContactID(node);
      } else if (typeof node === "object") {
        this.addSelfContactID(node.id);
      } else {
        this.addSelfContactID(node);
      }
    }
    return this;
  }

  addSelfContactID(
    id: ID | Builder<Contact>,
    options?: AssocEdgeInputOptions,
  ): UserBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.UserToSelfContact,
      NodeType.Contact,
      options,
    );
    return this;
  }

  removeSelfContact(...ids: ID[]): UserBuilder;
  removeSelfContact(...nodes: Contact[]): UserBuilder;
  removeSelfContact(...nodes: ID[] | Contact[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.UserToSelfContact,
        );
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.UserToSelfContact);
      }
    }
    return this;
  }

  addInvitedEvent(...ids: ID[]): UserBuilder;
  addInvitedEvent(...nodes: Event[]): UserBuilder;
  addInvitedEvent(...nodes: Builder<Event>[]): UserBuilder;
  addInvitedEvent(...nodes: ID[] | Event[] | Builder<Event>[]): UserBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addInvitedEventID(node);
      } else if (typeof node === "object") {
        this.addInvitedEventID(node.id);
      } else {
        this.addInvitedEventID(node);
      }
    }
    return this;
  }

  addInvitedEventID(
    id: ID | Builder<Event>,
    options?: AssocEdgeInputOptions,
  ): UserBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.UserToInvitedEvents,
      NodeType.Event,
      options,
    );
    return this;
  }

  removeInvitedEvent(...ids: ID[]): UserBuilder;
  removeInvitedEvent(...nodes: Event[]): UserBuilder;
  removeInvitedEvent(...nodes: ID[] | Event[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.UserToInvitedEvents,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.UserToInvitedEvents,
        );
      }
    }
    return this;
  }

  addEventsAttending(...ids: ID[]): UserBuilder;
  addEventsAttending(...nodes: Event[]): UserBuilder;
  addEventsAttending(...nodes: Builder<Event>[]): UserBuilder;
  addEventsAttending(...nodes: ID[] | Event[] | Builder<Event>[]): UserBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addEventsAttendingID(node);
      } else if (typeof node === "object") {
        this.addEventsAttendingID(node.id);
      } else {
        this.addEventsAttendingID(node);
      }
    }
    return this;
  }

  addEventsAttendingID(
    id: ID | Builder<Event>,
    options?: AssocEdgeInputOptions,
  ): UserBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.UserToEventsAttending,
      NodeType.Event,
      options,
    );
    return this;
  }

  removeEventsAttending(...ids: ID[]): UserBuilder;
  removeEventsAttending(...nodes: Event[]): UserBuilder;
  removeEventsAttending(...nodes: ID[] | Event[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.UserToEventsAttending,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.UserToEventsAttending,
        );
      }
    }
    return this;
  }

  addDeclinedEvent(...ids: ID[]): UserBuilder;
  addDeclinedEvent(...nodes: Event[]): UserBuilder;
  addDeclinedEvent(...nodes: Builder<Event>[]): UserBuilder;
  addDeclinedEvent(...nodes: ID[] | Event[] | Builder<Event>[]): UserBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addDeclinedEventID(node);
      } else if (typeof node === "object") {
        this.addDeclinedEventID(node.id);
      } else {
        this.addDeclinedEventID(node);
      }
    }
    return this;
  }

  addDeclinedEventID(
    id: ID | Builder<Event>,
    options?: AssocEdgeInputOptions,
  ): UserBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.UserToDeclinedEvents,
      NodeType.Event,
      options,
    );
    return this;
  }

  removeDeclinedEvent(...ids: ID[]): UserBuilder;
  removeDeclinedEvent(...nodes: Event[]): UserBuilder;
  removeDeclinedEvent(...nodes: ID[] | Event[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.UserToDeclinedEvents,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.UserToDeclinedEvents,
        );
      }
    }
    return this;
  }

  addMaybeEvent(...ids: ID[]): UserBuilder;
  addMaybeEvent(...nodes: Event[]): UserBuilder;
  addMaybeEvent(...nodes: Builder<Event>[]): UserBuilder;
  addMaybeEvent(...nodes: ID[] | Event[] | Builder<Event>[]): UserBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addMaybeEventID(node);
      } else if (typeof node === "object") {
        this.addMaybeEventID(node.id);
      } else {
        this.addMaybeEventID(node);
      }
    }
    return this;
  }

  addMaybeEventID(
    id: ID | Builder<Event>,
    options?: AssocEdgeInputOptions,
  ): UserBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.UserToMaybeEvents,
      NodeType.Event,
      options,
    );
    return this;
  }

  removeMaybeEvent(...ids: ID[]): UserBuilder;
  removeMaybeEvent(...nodes: Event[]): UserBuilder;
  removeMaybeEvent(...nodes: ID[] | Event[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.UserToMaybeEvents,
        );
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.UserToMaybeEvents);
      }
    }
    return this;
  }

  async build(): Promise<Changeset<User>> {
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

  async editedEnt(): Promise<User | null> {
    return await this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<User> {
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
    addField("FirstName", fields.firstName);
    addField("LastName", fields.lastName);
    addField("EmailAddress", fields.emailAddress);
    addField("PhoneNumber", fields.phoneNumber);
    addField("Password", fields.password);
    addField("AccountStatus", fields.accountStatus);
    addField("emailVerified", fields.emailVerified);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }
}
