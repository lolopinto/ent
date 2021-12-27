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
import { Address, Event, User } from "../../..";
import { EdgeType, NodeType } from "../../../generated/const";
import schema from "../../../../schema/event";

export interface EventInput {
  name?: string;
  creatorID?: ID;
  startTime?: Date;
  endTime?: Date | null;
  location?: string;
  addressID?: ID | null | Builder<Address>;
}

export interface EventAction extends Action<Event> {
  getInput(): EventInput;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class EventBuilder implements Builder<Event> {
  orchestrator: Orchestrator<Event>;
  readonly placeholderID: ID;
  readonly ent = Event;
  private input: EventInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: EventAction,
    public readonly existingEnt?: Event | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Event`;
    this.input = action.getInput();
    const updateInput = (d: EventInput) => this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "events",
      key: "id",
      loaderOptions: Event.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
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

  addAttending(...nodes: (ID | User | Builder<User>)[]): EventBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
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

  removeAttending(...nodes: (ID | User)[]): EventBuilder {
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

  addDeclined(...nodes: (ID | User | Builder<User>)[]): EventBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
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

  removeDeclined(...nodes: (ID | User)[]): EventBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.EventToDeclined);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.EventToDeclined);
      }
    }
    return this;
  }

  addHost(...nodes: (ID | User | Builder<User>)[]): EventBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
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

  removeHost(...nodes: (ID | User)[]): EventBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.EventToHosts);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.EventToHosts);
      }
    }
    return this;
  }

  addInvited(...nodes: (ID | User | Builder<User>)[]): EventBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
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

  removeInvited(...nodes: (ID | User)[]): EventBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(node.id, EdgeType.EventToInvited);
      } else {
        this.orchestrator.removeOutboundEdge(node, EdgeType.EventToInvited);
      }
    }
    return this;
  }

  addMaybe(...nodes: (ID | User | Builder<User>)[]): EventBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
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

  removeMaybe(...nodes: (ID | User)[]): EventBuilder {
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
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Event> {
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
    addField("name", fields.name);
    addField("creatorID", fields.creatorID);
    if (fields.creatorID !== undefined) {
      if (fields.creatorID) {
        this.orchestrator.addInboundEdge(
          fields.creatorID,
          EdgeType.UserToCreatedEvents,
          NodeType.User,
        );
      }
      if (
        this.existingEnt &&
        this.existingEnt.creatorID &&
        this.existingEnt.creatorID !== fields.creatorID
      ) {
        this.orchestrator.removeInboundEdge(
          this.existingEnt.creatorID,
          EdgeType.UserToCreatedEvents,
        );
      }
    }
    addField("start_time", fields.startTime);
    addField("end_time", fields.endTime);
    addField("location", fields.location);
    addField("addressID", fields.addressID);
    if (fields.addressID !== undefined) {
      if (fields.addressID) {
        this.orchestrator.addInboundEdge(
          fields.addressID,
          EdgeType.AddressToHostedEvents,
          NodeType.Address,
        );
      }
      if (
        this.existingEnt &&
        this.existingEnt.addressID &&
        this.existingEnt.addressID !== fields.addressID
      ) {
        this.orchestrator.removeInboundEdge(
          this.existingEnt.addressID,
          EdgeType.AddressToHostedEvents,
        );
      }
    }
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of name. Retrieves it from the input if specified or takes it from existingEnt
  getNewNameValue(): string | undefined {
    if (this.input.name !== undefined) {
      return this.input.name;
    }
    return this.existingEnt?.name;
  }

  // get value of creatorID. Retrieves it from the input if specified or takes it from existingEnt
  getNewCreatorIDValue(): ID | undefined {
    if (this.input.creatorID !== undefined) {
      return this.input.creatorID;
    }
    return this.existingEnt?.creatorID;
  }

  // get value of start_time. Retrieves it from the input if specified or takes it from existingEnt
  getNewStartTimeValue(): Date | undefined {
    if (this.input.startTime !== undefined) {
      return this.input.startTime;
    }
    return this.existingEnt?.startTime;
  }

  // get value of end_time. Retrieves it from the input if specified or takes it from existingEnt
  getNewEndTimeValue(): Date | null | undefined {
    if (this.input.endTime !== undefined) {
      return this.input.endTime;
    }
    return this.existingEnt?.endTime;
  }

  // get value of location. Retrieves it from the input if specified or takes it from existingEnt
  getNewLocationValue(): string | undefined {
    if (this.input.location !== undefined) {
      return this.input.location;
    }
    return this.existingEnt?.location;
  }

  // get value of addressID. Retrieves it from the input if specified or takes it from existingEnt
  getNewAddressIDValue(): ID | null | Builder<Address> | undefined {
    if (this.input.addressID !== undefined) {
      return this.input.addressID;
    }
    return this.existingEnt?.addressID;
  }
}
