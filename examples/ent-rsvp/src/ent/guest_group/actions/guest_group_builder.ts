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
import schema from "src/schema/guest_group";
import { EdgeType, NodeType } from "src/ent/const";
import { GuestGroup, EventActivity, Event } from "src/ent/";

export interface GuestGroupInput {
  invitationName?: string;
  eventID?: ID | Builder<Event>;
}

export interface GuestGroupAction extends Action<GuestGroup> {
  getInput(): GuestGroupInput;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class GuestGroupBuilder implements Builder<GuestGroup> {
  private orchestrator: Orchestrator<GuestGroup>;
  readonly placeholderID: ID;
  readonly ent = GuestGroup;
  private input: GuestGroupInput;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: GuestGroupAction,
    public readonly existingEnt?: GuestGroup | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}`;
    this.input = action.getInput();

    this.orchestrator = new Orchestrator({
      viewer: viewer,
      operation: this.operation,
      tableName: "guest_groups",
      ent: GuestGroup,
      builder: this,
      action: action,
      schema: schema,
      editedFields: () => {
        return this.getEditedFields.apply(this);
      },
    });
  }

  getInput(): GuestGroupInput {
    return this.input;
  }

  updateInput(input: GuestGroupInput) {
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
  addGuestGroupToInvitedEvent(...ids: ID[]): GuestGroupBuilder;
  addGuestGroupToInvitedEvent(...nodes: EventActivity[]): GuestGroupBuilder;
  addGuestGroupToInvitedEvent(
    ...nodes: Builder<EventActivity>[]
  ): GuestGroupBuilder;
  addGuestGroupToInvitedEvent(
    ...nodes: ID[] | EventActivity[] | Builder<EventActivity>[]
  ): GuestGroupBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addGuestGroupToInvitedEventID(node);
      } else if (typeof node === "object") {
        this.addGuestGroupToInvitedEventID(node.id);
      } else {
        this.addGuestGroupToInvitedEventID(node);
      }
    }
    return this;
  }

  addGuestGroupToInvitedEventID(
    id: ID | Builder<EventActivity>,
    options?: AssocEdgeInputOptions,
  ): GuestGroupBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.GuestGroupToInvitedEvents,
      NodeType.EventActivity,
      options,
    );
    return this;
  }

  removeGuestGroupToInvitedEvent(...ids: ID[]): GuestGroupBuilder;
  removeGuestGroupToInvitedEvent(...nodes: EventActivity[]): GuestGroupBuilder;
  removeGuestGroupToInvitedEvent(
    ...nodes: ID[] | EventActivity[]
  ): GuestGroupBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.GuestGroupToInvitedEvents,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.GuestGroupToInvitedEvents,
        );
      }
    }
    return this;
  }

  async build(): Promise<Changeset<GuestGroup>> {
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

  async editedEnt(): Promise<GuestGroup | null> {
    return await this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<GuestGroup> {
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
    addField("InvitationName", fields.invitationName);
    addField("EventID", fields.eventID);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }
}
