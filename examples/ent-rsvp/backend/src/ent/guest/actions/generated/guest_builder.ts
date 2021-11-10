// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

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
import { Event, EventActivity, Guest, GuestGroup } from "src/ent/";
import { EdgeType, NodeType } from "src/ent/generated/const";
import schema from "src/schema/guest";

export interface GuestInput {
  name?: string;
  eventID?: ID | Builder<Event>;
  emailAddress?: string | null;
  guestGroupID?: ID | Builder<GuestGroup>;
  title?: string | null;
  // allow other properties. useful for action-only fields
  [x: string]: any;
}

export interface GuestAction<TData extends GuestInput>
  extends Action<Guest, GuestBuilder<TData>, TData> {
  getInput(): TData;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

export class GuestBuilder<TData extends GuestInput = GuestInput>
  implements Builder<Guest>
{
  orchestrator: Orchestrator<Guest, TData>;
  readonly placeholderID: ID;
  readonly ent = Guest;
  private input: TData;

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: GuestAction<TData>,
    public readonly existingEnt?: Guest | undefined,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-Guest`;
    this.input = action.getInput();

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "guests",
      key: "id",
      loaderOptions: Guest.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
    });
  }

  getInput(): TData {
    return this.input;
  }

  updateInput(input: GuestInput) {
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

  addGuestToAttendingEvent(
    ...nodes: (ID | EventActivity | Builder<EventActivity>)[]
  ): GuestBuilder<TData> {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addGuestToAttendingEventID(node);
      } else if (typeof node === "object") {
        this.addGuestToAttendingEventID(node.id);
      } else {
        this.addGuestToAttendingEventID(node);
      }
    }
    return this;
  }

  addGuestToAttendingEventID(
    id: ID | Builder<EventActivity>,
    options?: AssocEdgeInputOptions,
  ): GuestBuilder<TData> {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.GuestToAttendingEvents,
      NodeType.EventActivity,
      options,
    );
    return this;
  }

  removeGuestToAttendingEvent(
    ...nodes: (ID | EventActivity)[]
  ): GuestBuilder<TData> {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.GuestToAttendingEvents,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.GuestToAttendingEvents,
        );
      }
    }
    return this;
  }

  addGuestToDeclinedEvent(
    ...nodes: (ID | EventActivity | Builder<EventActivity>)[]
  ): GuestBuilder<TData> {
    for (const node of nodes) {
      if (this.isBuilder(node)) {
        this.addGuestToDeclinedEventID(node);
      } else if (typeof node === "object") {
        this.addGuestToDeclinedEventID(node.id);
      } else {
        this.addGuestToDeclinedEventID(node);
      }
    }
    return this;
  }

  addGuestToDeclinedEventID(
    id: ID | Builder<EventActivity>,
    options?: AssocEdgeInputOptions,
  ): GuestBuilder<TData> {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.GuestToDeclinedEvents,
      NodeType.EventActivity,
      options,
    );
    return this;
  }

  removeGuestToDeclinedEvent(
    ...nodes: (ID | EventActivity)[]
  ): GuestBuilder<TData> {
    for (const node of nodes) {
      if (typeof node === "object") {
        this.orchestrator.removeOutboundEdge(
          node.id,
          EdgeType.GuestToDeclinedEvents,
        );
      } else {
        this.orchestrator.removeOutboundEdge(
          node,
          EdgeType.GuestToDeclinedEvents,
        );
      }
    }
    return this;
  }

  async build(): Promise<Changeset<Guest>> {
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

  async editedEnt(): Promise<Guest | null> {
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<Guest> {
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
    addField("Name", fields.name);
    addField("eventID", fields.eventID);
    addField("EmailAddress", fields.emailAddress);
    addField("guestGroupID", fields.guestGroupID);
    addField("title", fields.title);
    return result;
  }

  isBuilder(node: ID | Ent | Builder<Ent>): node is Builder<Ent> {
    return (node as Builder<Ent>).placeholderID !== undefined;
  }

  // get value of Name. Retrieves it from the input if specified or takes it from existingEnt
  getNewNameValue(): string | undefined {
    return this.input.name || this.existingEnt?.name;
  }

  // get value of eventID. Retrieves it from the input if specified or takes it from existingEnt
  getNewEventIDValue(): ID | Builder<Event> | undefined {
    return this.input.eventID || this.existingEnt?.eventID;
  }

  // get value of EmailAddress. Retrieves it from the input if specified or takes it from existingEnt
  getNewEmailAddressValue(): string | null | undefined {
    return this.input.emailAddress || this.existingEnt?.emailAddress;
  }

  // get value of guestGroupID. Retrieves it from the input if specified or takes it from existingEnt
  getNewGuestGroupIDValue(): ID | Builder<GuestGroup> | undefined {
    return this.input.guestGroupID || this.existingEnt?.guestGroupID;
  }

  // get value of title. Retrieves it from the input if specified or takes it from existingEnt
  getNewTitleValue(): string | null | undefined {
    return this.input.title || this.existingEnt?.title;
  }
}
