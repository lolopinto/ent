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
import schema from "src/schema/event_activity";
import { EdgeType, NodeType } from "src/ent/const";
import { EventActivity, Guest, GuestGroup, Event } from "src/ent/";

export interface EventActivityInput {
  name?: string;
  eventID?: ID | Builder<Event>;
  startTime?: Date;
  endTime?: Date | null;
  location?: string;
  description?: string | null;
  inviteAllGuests?: boolean;
}

export interface EventActivityAction extends Action<EventActivity> {
  getInput(): EventActivityInput;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class EventActivityBuilder implements Builder<EventActivity> {
  orchestrator: Orchestrator<EventActivity>;
  readonly placeholderID: ID;
  readonly ent = EventActivity;
  private input: EventActivityInput;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: EventActivityAction,
    public readonly existingEnt?: EventActivity | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-EventActivity`;
    this.input = action.getInput();

    this.orchestrator = new Orchestrator({
      viewer: viewer,
      operation: this.operation,
      tableName: "event_activities",
      loaderOptions: EventActivity.loaderOptions(),
      builder: this,
      action: action,
      schema: schema,
      editedFields: () => {
        return this.getEditedFields.apply(this);
      },
    });
  }

  getInput(): EventActivityInput {
    return this.input;
  }

  updateInput(input: EventActivityInput) {
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
  addAttending(...ids: ID[]): EventActivityBuilder;
  addAttending(...nodes: Guest[]): EventActivityBuilder;
  addAttending(...nodes: Builder<Guest>[]): EventActivityBuilder;
  addAttending(
    ...nodes: ID[] | Guest[] | Builder<Guest>[]
  ): EventActivityBuilder {
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
    id: ID | Builder<Guest>,
    options?: AssocEdgeInputOptions,
  ): EventActivityBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.EventActivityToAttending,
      NodeType.Guest,
      options,
    );
    return this;
  }

  removeAttending(...ids: ID[]): EventActivityBuilder;
  removeAttending(...nodes: Guest[]): EventActivityBuilder;
  removeAttending(...nodes: ID[] | Guest[]): EventActivityBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.EventActivityToAttending,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.EventActivityToAttending,
        );
      }
    }
    return this;
  }

  addDeclined(...ids: ID[]): EventActivityBuilder;
  addDeclined(...nodes: Guest[]): EventActivityBuilder;
  addDeclined(...nodes: Builder<Guest>[]): EventActivityBuilder;
  addDeclined(
    ...nodes: ID[] | Guest[] | Builder<Guest>[]
  ): EventActivityBuilder {
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
    id: ID | Builder<Guest>,
    options?: AssocEdgeInputOptions,
  ): EventActivityBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.EventActivityToDeclined,
      NodeType.Guest,
      options,
    );
    return this;
  }

  removeDeclined(...ids: ID[]): EventActivityBuilder;
  removeDeclined(...nodes: Guest[]): EventActivityBuilder;
  removeDeclined(...nodes: ID[] | Guest[]): EventActivityBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.EventActivityToDeclined,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.EventActivityToDeclined,
        );
      }
    }
    return this;
  }

  addInvite(...ids: ID[]): EventActivityBuilder;
  addInvite(...nodes: GuestGroup[]): EventActivityBuilder;
  addInvite(...nodes: Builder<GuestGroup>[]): EventActivityBuilder;
  addInvite(
    ...nodes: ID[] | GuestGroup[] | Builder<GuestGroup>[]
  ): EventActivityBuilder {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addInviteID(node);
      } else if (typeof node === "object") {
        this.addInviteID(node.id);
      } else {
        this.addInviteID(node);
      }
    }
    return this;
  }

  addInviteID(
    id: ID | Builder<GuestGroup>,
    options?: AssocEdgeInputOptions,
  ): EventActivityBuilder {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.EventActivityToInvites,
      NodeType.GuestGroup,
      options,
    );
    return this;
  }

  removeInvite(...ids: ID[]): EventActivityBuilder;
  removeInvite(...nodes: GuestGroup[]): EventActivityBuilder;
  removeInvite(...nodes: ID[] | GuestGroup[]): EventActivityBuilder {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.EventActivityToInvites,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.EventActivityToInvites,
        );
      }
    }
    return this;
  }

  async build(): Promise<Changeset<EventActivity>> {
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

  async editedEnt(): Promise<EventActivity | null> {
    return await this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<EventActivity> {
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
    addField("Name", fields.name);
    addField("eventID", fields.eventID);
    addField("StartTime", fields.startTime);
    addField("EndTime", fields.endTime);
    addField("Location", fields.location);
    addField("Description", fields.description);
    addField("InviteAllGuests", fields.inviteAllGuests);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }
}
