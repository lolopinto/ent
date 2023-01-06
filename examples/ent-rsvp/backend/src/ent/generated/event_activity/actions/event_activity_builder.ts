// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { AssocEdgeInputOptions, Ent, ID, Viewer } from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  Orchestrator,
  OrchestratorOptions,
  WriteOperation,
  saveBuilder,
  saveBuilderX,
} from "@snowtop/ent/action";
import { Address, Event, EventActivity, Guest, GuestGroup } from "src/ent/";
import { eventActivityLoaderInfo } from "src/ent/generated/loaders";
import { EdgeType, NodeType } from "src/ent/generated/types";
import schema from "src/schema/event_activity_schema";

export interface EventActivityInput {
  addressId?: ID | null | Builder<Address, Viewer>;
  name?: string;
  eventID?: ID | Builder<Event, Viewer>;
  startTime?: Date;
  endTime?: Date | null;
  location?: string;
  description?: string | null;
  inviteAllGuests?: boolean;
  // allow other properties. useful for action-only fields
  [x: string]: any;
}

function randomNum(): string {
  return Math.random().toString(10).substring(2);
}

type MaybeNull<T extends Ent> = T | null;
type TMaybleNullableEnt<T extends Ent> = T | MaybeNull<T>;

export class EventActivityBuilder<
  TInput extends EventActivityInput = EventActivityInput,
  TExistingEnt extends TMaybleNullableEnt<EventActivity> = EventActivity | null,
> implements Builder<EventActivity, Viewer, TExistingEnt>
{
  orchestrator: Orchestrator<EventActivity, TInput, Viewer, TExistingEnt>;
  readonly placeholderID: ID;
  readonly ent = EventActivity;
  readonly nodeType = NodeType.EventActivity;
  private input: TInput;
  private m: Map<string, any> = new Map();

  public constructor(
    public readonly viewer: Viewer,
    public readonly operation: WriteOperation,
    action: Action<
      EventActivity,
      Builder<EventActivity, Viewer, TExistingEnt>,
      Viewer,
      TInput,
      TExistingEnt
    >,
    public readonly existingEnt: TExistingEnt,
    opts?: Partial<
      OrchestratorOptions<EventActivity, TInput, Viewer, TExistingEnt>
    >,
  ) {
    this.placeholderID = `$ent.idPlaceholderID$ ${randomNum()}-EventActivity`;
    this.input = action.getInput();
    const updateInput = (d: EventActivityInput) =>
      this.updateInput.apply(this, [d]);

    this.orchestrator = new Orchestrator({
      viewer,
      operation: this.operation,
      tableName: "event_activities",
      key: "id",
      loaderOptions: EventActivity.loaderOptions(),
      builder: this,
      action,
      schema,
      editedFields: () => this.getEditedFields.apply(this),
      updateInput,
      fieldInfo: eventActivityLoaderInfo.fieldInfo,
      ...opts,
    });
  }

  getInput(): TInput {
    return this.input;
  }

  updateInput(input: EventActivityInput) {
    // override input
    this.input = {
      ...this.input,
      ...input,
    };
  }

  deleteInputKey(key: keyof EventActivityInput) {
    delete this.input[key];
  }

  // store data in Builder that can be retrieved by another validator, trigger, observer later in the action
  storeData(k: string, v: any) {
    this.m.set(k, v);
  }

  // retrieve data stored in this Builder with key
  getStoredData(k: string) {
    return this.m.get(k);
  }

  // this returns the id of the existing ent or the id of the ent that's being created
  async getEntID() {
    if (this.existingEnt) {
      return this.existingEnt.id;
    }
    const edited = await this.orchestrator.getEditedData();
    if (!edited.id) {
      throw new Error(
        `couldn't get the id field. should have been set by 'defaultValueOnCreate'`,
      );
    }
    return edited.id;
  }
  // this gets the inputs that have been written for a given edgeType and operation
  // WriteOperation.Insert for adding an edge and WriteOperation.Delete for deleting an edge
  getEdgeInputData(edgeType: EdgeType, op: WriteOperation) {
    return this.orchestrator.getInputEdges(edgeType, op);
  }

  clearInputEdges(edgeType: EdgeType, op: WriteOperation, id?: ID) {
    this.orchestrator.clearInputEdges(edgeType, op, id);
  }

  addAttending(...nodes: (ID | Guest | Builder<Guest, any>)[]): this {
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
    id: ID | Builder<Guest, any>,
    options?: AssocEdgeInputOptions,
  ): this {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.EventActivityToAttending,
      NodeType.Guest,
      options,
    );
    return this;
  }

  removeAttending(...nodes: (ID | Guest)[]): this {
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

  addDeclined(...nodes: (ID | Guest | Builder<Guest, any>)[]): this {
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
    id: ID | Builder<Guest, any>,
    options?: AssocEdgeInputOptions,
  ): this {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.EventActivityToDeclined,
      NodeType.Guest,
      options,
    );
    return this;
  }

  removeDeclined(...nodes: (ID | Guest)[]): this {
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

  addInvite(...nodes: (ID | GuestGroup | Builder<GuestGroup, any>)[]): this {
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
    id: ID | Builder<GuestGroup, any>,
    options?: AssocEdgeInputOptions,
  ): this {
    this.orchestrator.addOutboundEdge(
      id,
      EdgeType.EventActivityToInvites,
      NodeType.GuestGroup,
      options,
    );
    return this;
  }

  removeInvite(...nodes: (ID | GuestGroup)[]): this {
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

  async build(): Promise<Changeset> {
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
    return this.orchestrator.editedEnt();
  }

  async editedEntX(): Promise<EventActivity> {
    return this.orchestrator.editedEntX();
  }

  private async getEditedFields(): Promise<Map<string, any>> {
    const input = this.input;

    const result = new Map<string, any>();

    const addField = function (key: string, value: any) {
      if (value !== undefined) {
        result.set(key, value);
      }
    };
    addField("address_id", input.addressId);
    if (input.addressId !== undefined) {
      if (input.addressId) {
        this.orchestrator.addInboundEdge(
          input.addressId,
          EdgeType.AddressToLocatedAt,
          NodeType.Address,
        );
      }
      if (
        this.existingEnt &&
        this.existingEnt.addressId &&
        this.existingEnt.addressId !== input.addressId
      ) {
        this.orchestrator.removeInboundEdge(
          this.existingEnt.addressId,
          EdgeType.AddressToLocatedAt,
        );
      }
    }
    addField("Name", input.name);
    addField("eventID", input.eventID);
    addField("StartTime", input.startTime);
    addField("EndTime", input.endTime);
    addField("Location", input.location);
    addField("Description", input.description);
    addField("InviteAllGuests", input.inviteAllGuests);
    return result;
  }

  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any> {
    return (node as Builder<T, any>).placeholderID !== undefined;
  }

  // get value of address_id. Retrieves it from the input if specified or takes it from existingEnt
  getNewAddressIdValue(): ID | null | Builder<Address, Viewer> {
    if (this.input.addressId !== undefined) {
      return this.input.addressId;
    }

    return this.existingEnt?.addressId ?? null;
  }

  // get value of Name. Retrieves it from the input if specified or takes it from existingEnt
  getNewNameValue(): string {
    if (this.input.name !== undefined) {
      return this.input.name;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `name` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.name;
  }

  // get value of eventID. Retrieves it from the input if specified or takes it from existingEnt
  getNewEventIDValue(): ID | Builder<Event, Viewer> {
    if (this.input.eventID !== undefined) {
      return this.input.eventID;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `eventID` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.eventID;
  }

  // get value of StartTime. Retrieves it from the input if specified or takes it from existingEnt
  getNewStartTimeValue(): Date {
    if (this.input.startTime !== undefined) {
      return this.input.startTime;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `startTime` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.startTime;
  }

  // get value of EndTime. Retrieves it from the input if specified or takes it from existingEnt
  getNewEndTimeValue(): Date | null {
    if (this.input.endTime !== undefined) {
      return this.input.endTime;
    }

    return this.existingEnt?.endTime ?? null;
  }

  // get value of Location. Retrieves it from the input if specified or takes it from existingEnt
  getNewLocationValue(): string {
    if (this.input.location !== undefined) {
      return this.input.location;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `location` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.location;
  }

  // get value of Description. Retrieves it from the input if specified or takes it from existingEnt
  getNewDescriptionValue(): string | null {
    if (this.input.description !== undefined) {
      return this.input.description;
    }

    return this.existingEnt?.description ?? null;
  }

  // get value of InviteAllGuests. Retrieves it from the input if specified or takes it from existingEnt
  getNewInviteAllGuestsValue(): boolean {
    if (this.input.inviteAllGuests !== undefined) {
      return this.input.inviteAllGuests;
    }

    if (!this.existingEnt) {
      throw new Error(
        "no value to return for `inviteAllGuests` since not in input and no existingEnt",
      );
    }
    return this.existingEnt.inviteAllGuests;
  }
}
