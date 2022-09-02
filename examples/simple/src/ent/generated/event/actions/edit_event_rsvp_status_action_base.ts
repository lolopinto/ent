/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
} from "@snowtop/ent";
import {
  Action,
  Changeset,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
  setEdgeTypeInGroup,
} from "@snowtop/ent/action";
import { Event, NodeType } from "../../..";
import { EventBuilder } from "./event_builder";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export enum EventRsvpStatusInput {
  Attending = "attending",
  Declined = "declined",
  Maybe = "maybe",
}

export interface EditEventRsvpStatusInput {
  rsvpStatus: EventRsvpStatusInput;
  // TODO if viewer based, we shouldn't even pass this since you shouldn't be able
  // to set this for other users...
  userID: ID;
}

export type EditEventRsvpStatusActionTriggers = (
  | Trigger<
      Event,
      EventBuilder<EditEventRsvpStatusInput, Event>,
      ExampleViewerAlias,
      EditEventRsvpStatusInput,
      Event
    >
  | Trigger<
      Event,
      EventBuilder<EditEventRsvpStatusInput, Event>,
      ExampleViewerAlias,
      EditEventRsvpStatusInput,
      Event
    >[]
)[];

export type EditEventRsvpStatusActionObservers = Observer<
  Event,
  EventBuilder<EditEventRsvpStatusInput, Event>,
  ExampleViewerAlias,
  EditEventRsvpStatusInput,
  Event
>[];

export type EditEventRsvpStatusActionValidators = Validator<
  Event,
  EventBuilder<EditEventRsvpStatusInput, Event>,
  ExampleViewerAlias,
  EditEventRsvpStatusInput,
  Event
>[];

export class EditEventRsvpStatusActionBase
  implements
    Action<
      Event,
      EventBuilder<EditEventRsvpStatusInput, Event>,
      ExampleViewerAlias,
      EditEventRsvpStatusInput,
      Event
    >
{
  public readonly builder: EventBuilder<EditEventRsvpStatusInput, Event>;
  public readonly viewer: ExampleViewerAlias;
  protected input: EditEventRsvpStatusInput;
  protected readonly event: Event;

  constructor(
    viewer: ExampleViewerAlias,
    event: Event,
    input: EditEventRsvpStatusInput,
  ) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new EventBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      event,
    );
    this.event = event;
  }

  getPrivacyPolicy(): PrivacyPolicy<Event, ExampleViewerAlias> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): EditEventRsvpStatusActionTriggers {
    return [];
  }

  getObservers(): EditEventRsvpStatusActionObservers {
    return [];
  }

  getValidators(): EditEventRsvpStatusActionValidators {
    return [];
  }

  getInput(): EditEventRsvpStatusInput {
    return this.input;
  }

  async changeset(): Promise<Changeset> {
    return this.builder.build();
  }

  private async setEdgeType() {
    await setEdgeTypeInGroup(
      this.builder.orchestrator,
      this.input.rsvpStatus,
      this.event.id,
      this.input.userID,
      NodeType.Event,
      this.event.getEventRsvpStatusMap(),
    );
  }

  async valid(): Promise<boolean> {
    await this.setEdgeType();
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.setEdgeType();
    await this.builder.validX();
  }

  async save(): Promise<Event | null> {
    await this.setEdgeType();
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Event> {
    await this.setEdgeType();
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends EditEventRsvpStatusActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      event: Event,
      input: EditEventRsvpStatusInput,
    ) => T,
    viewer: ExampleViewerAlias,
    event: Event,
    input: EditEventRsvpStatusInput,
  ): T {
    return new this(viewer, event, input);
  }

  static async saveXFromID<T extends EditEventRsvpStatusActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      event: Event,
      input: EditEventRsvpStatusInput,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
    input: EditEventRsvpStatusInput,
  ): Promise<Event> {
    const event = await Event.loadX(viewer, id);
    return new this(viewer, event, input).saveX();
  }
}
