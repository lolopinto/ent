// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Viewer, ID, AssocEdgeInputOptions } from "ent/ent";
import {
  Action,
  Builder,
  WriteOperation,
  Changeset,
  saveBuilder,
  saveBuilderX,
} from "ent/action";
import { Orchestrator } from "ent/orchestrator";
import schema from "src/schema/event";
import { EdgeType, NodeType } from "src/ent/const";
import Event from "src/ent/event";
import User from "src/ent/user";

export interface EventInput {
  name?: string;
  creatorID?: ID | Builder<User>;
  startTime?: Date;
  endTime?: Date | null;
  location?: string;
}

export interface EventAction extends Action<Event> {
  getInput(): EventInput;
}

function randomNum(): string {
  return Math.random()
    .toString(10)
    .substring(2);
}

export class EventBuilder implements Builder<Event> {
  private orchestrator: Orchestrator<Event>;
  readonly placeholderID: ID;
  readonly ent = Event;
  private input: EventInput;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    private action: EventAction,
    public readonly existingEnt?: Event | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}`;
    this.input = action.getInput();

    this.orchestrator = new Orchestrator({
      viewer: viewer,
      operation: this.operation,
      tableName: "events",
      ent: Event,
      builder: this,
      action: action,
      schema: schema,
      editedFields: () => {
        return this.getEditedFields.apply(this);
      },
    });
  }

  getInput(): EventInput {
    return this.input;
  }

  updateInput(input: EventInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  addHost(...ids: ID[]): EventBuilder;
  addHost(...nodes: User[]): EventBuilder;
  addHost(...nodes: Builder<User>[]): EventBuilder;
  addHost(...nodes: ID[] | User[] | Builder<User>[]): EventBuilder {
    for (const node of nodes) {
      if (this.isUserBuilder(node)) {
        this.addHostID(node);
      } else if (typeof node === "object") {
        this.addHostID(node.id);
      } else {
        this.addHostID(node);
      }
    }
    return this;
  }

  addHostID(
    id: ID | Builder<User>,
    options?: AssocEdgeInputOptions,
  ): EventBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.EventToHosts,
      NodeType.User,
      options,
    );
    return this;
  }

  removeHost(...ids: ID[]): EventBuilder;
  removeHost(...nodes: User[]): EventBuilder;
  removeHost(...nodes: ID[] | User[]): EventBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.EventToHosts);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.EventToHosts);
      }
    }
    return this;
  }

  addInvited(...ids: ID[]): EventBuilder;
  addInvited(...nodes: User[]): EventBuilder;
  addInvited(...nodes: Builder<User>[]): EventBuilder;
  addInvited(...nodes: ID[] | User[] | Builder<User>[]): EventBuilder {
    for (const node of nodes) {
      if (this.isUserBuilder(node)) {
        this.addInvitedID(node);
      } else if (typeof node === "object") {
        this.addInvitedID(node.id);
      } else {
        this.addInvitedID(node);
      }
    }
    return this;
  }

  addInvitedID(
    id: ID | Builder<User>,
    options?: AssocEdgeInputOptions,
  ): EventBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.EventToInvited,
      NodeType.User,
      options,
    );
    return this;
  }

  removeInvited(...ids: ID[]): EventBuilder;
  removeInvited(...nodes: User[]): EventBuilder;
  removeInvited(...nodes: ID[] | User[]): EventBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.EventToInvited);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.EventToInvited);
      }
    }
    return this;
  }

  addAttending(...ids: ID[]): EventBuilder;
  addAttending(...nodes: User[]): EventBuilder;
  addAttending(...nodes: Builder<User>[]): EventBuilder;
  addAttending(...nodes: ID[] | User[] | Builder<User>[]): EventBuilder {
    for (const node of nodes) {
      if (this.isUserBuilder(node)) {
        this.addAttendingID(node);
      } else if (typeof node === "object") {
        this.addAttendingID(node.id);
      } else {
        this.addAttendingID(node);
      }
    }
    return this;
  }

  addAttendingID(
    id: ID | Builder<User>,
    options?: AssocEdgeInputOptions,
  ): EventBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.EventToAttending,
      NodeType.User,
      options,
    );
    return this;
  }

  removeAttending(...ids: ID[]): EventBuilder;
  removeAttending(...nodes: User[]): EventBuilder;
  removeAttending(...nodes: ID[] | User[]): EventBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.EventToAttending,
        );
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.EventToAttending);
      }
    }
    return this;
  }

  addDeclined(...ids: ID[]): EventBuilder;
  addDeclined(...nodes: User[]): EventBuilder;
  addDeclined(...nodes: Builder<User>[]): EventBuilder;
  addDeclined(...nodes: ID[] | User[] | Builder<User>[]): EventBuilder {
    for (const node of nodes) {
      if (this.isUserBuilder(node)) {
        this.addDeclinedID(node);
      } else if (typeof node === "object") {
        this.addDeclinedID(node.id);
      } else {
        this.addDeclinedID(node);
      }
    }
    return this;
  }

  addDeclinedID(
    id: ID | Builder<User>,
    options?: AssocEdgeInputOptions,
  ): EventBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.EventToDeclined,
      NodeType.User,
      options,
    );
    return this;
  }

  removeDeclined(...ids: ID[]): EventBuilder;
  removeDeclined(...nodes: User[]): EventBuilder;
  removeDeclined(...nodes: ID[] | User[]): EventBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.EventToDeclined);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.EventToDeclined);
      }
    }
    return this;
  }

  addMaybe(...ids: ID[]): EventBuilder;
  addMaybe(...nodes: User[]): EventBuilder;
  addMaybe(...nodes: Builder<User>[]): EventBuilder;
  addMaybe(...nodes: ID[] | User[] | Builder<User>[]): EventBuilder {
    for (const node of nodes) {
      if (this.isUserBuilder(node)) {
        this.addMaybeID(node);
      } else if (typeof node === "object") {
        this.addMaybeID(node.id);
      } else {
        this.addMaybeID(node);
      }
    }
    return this;
  }

  addMaybeID(
    id: ID | Builder<User>,
    options?: AssocEdgeInputOptions,
  ): EventBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.EventToMaybe,
      NodeType.User,
      options,
    );
    return this;
  }

  removeMaybe(...ids: ID[]): EventBuilder;
  removeMaybe(...nodes: User[]): EventBuilder;
  removeMaybe(...nodes: ID[] | User[]): EventBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.EventToMaybe);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.EventToMaybe);
      }
    }
    return this;
  }

  async build(): Promise<Changeset<Event>> {
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

  async editedEnt(): Promise<Event | null> {
    return await this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Event> {
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
    addField("name", fields.name);
    addField("creatorID", fields.creatorID);
    if (fields.creatorID) {
      this.orchestrator.addInboundEdge(
        fields.creatorID,
        EdgeType.UserToCreatedEvents,
        NodeType.User,
      );
    }
    addField("start_time", fields.startTime);
    addField("end_time", fields.endTime);
    addField("location", fields.location);
    return result;
  }

  private isUserBuilder(
    node: ID | User | Builder<User>,
  ): node is Builder<User> {
    return (node as Builder<User>).placeholderID !== undefined;
  }
}
