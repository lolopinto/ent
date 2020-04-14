// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Viewer, ID, AssocEdgeInputOptions } from "ent/ent";
import { Action, Builder, WriteOperation, Changeset } from "ent/action";
import { Orchestrator } from "ent/orchestrator";
import schema from "src/schema/user";
import { EdgeType, NodeType } from "src/ent/const";
import User from "src/ent/user";
import Event from "src/ent/event";
import Contact from "src/ent/contact";

export interface UserInput {
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  accountStatus?: string | null;
  emailVerified?: boolean;
  requiredFields: string[];
}

export interface UserAction extends Action<User> {
  getInput(): UserInput;
}

function randomNum(): string {
  return Math.random()
    .toString(10)
    .substring(2);
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

  // TODO... need to kill requiredFields anyways.
  updateInput(input: Exclude<Partial<UserInput>, "requiredFields">) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
    console.log(this.input);
  }

  private getEditedFields(): Map<string, any> {
    const fields = this.input;

    // required fields
    let m = {};
    let result = new Map<string, any>();
    for (const field of fields.requiredFields) {
      m[field] = true;
    }

    const addField = function(key: string, value: any, setNull: boolean) {
      if (value !== undefined) {
        result.set(key, value);
      } else if (setNull) {
        result.set(key, null);
      }
    };
    addField("FirstName", fields.firstName, m["FirstName"]);
    addField("LastName", fields.lastName, m["LastName"]);
    addField("EmailAddress", fields.emailAddress, m["EmailAddress"]);
    addField("AccountStatus", fields.accountStatus, m["AccountStatus"]);
    addField("emailVerified", fields.emailVerified, m["emailVerified"]);
    return result;
  }

  addCreatedEvent(...ids: ID[]): UserBuilder;
  addCreatedEvent(...nodes: Event[]): UserBuilder;
  addCreatedEvent(...nodes: ID[] | Event[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.addCreatedEventID(node.id);
      } else {
        this.addCreatedEventID(node);
      }
    }
    return this;
  }

  addCreatedEventID(id: ID, options?: AssocEdgeInputOptions): UserBuilder {
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
  addFriend(...nodes: ID[] | User[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.addFriendID(node.id);
      } else {
        this.addFriendID(node);
      }
    }
    return this;
  }

  addFriendID(id: ID, options?: AssocEdgeInputOptions): UserBuilder {
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
  addSelfContact(...nodes: ID[] | Contact[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.addSelfContactID(node.id);
      } else {
        this.addSelfContactID(node);
      }
    }
    return this;
  }

  addSelfContactID(id: ID, options?: AssocEdgeInputOptions): UserBuilder {
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
  addInvitedEvent(...nodes: ID[] | Event[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.addInvitedEventID(node.id);
      } else {
        this.addInvitedEventID(node);
      }
    }
    return this;
  }

  addInvitedEventID(id: ID, options?: AssocEdgeInputOptions): UserBuilder {
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
  addEventsAttending(...nodes: ID[] | Event[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.addEventsAttendingID(node.id);
      } else {
        this.addEventsAttendingID(node);
      }
    }
    return this;
  }

  addEventsAttendingID(id: ID, options?: AssocEdgeInputOptions): UserBuilder {
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
  addDeclinedEvent(...nodes: ID[] | Event[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.addDeclinedEventID(node.id);
      } else {
        this.addDeclinedEventID(node);
      }
    }
    return this;
  }

  addDeclinedEventID(id: ID, options?: AssocEdgeInputOptions): UserBuilder {
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
  addMaybeEvent(...nodes: ID[] | Event[]): UserBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.addMaybeEventID(node.id);
      } else {
        this.addMaybeEventID(node);
      }
    }
    return this;
  }

  addMaybeEventID(id: ID, options?: AssocEdgeInputOptions): UserBuilder {
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
}
