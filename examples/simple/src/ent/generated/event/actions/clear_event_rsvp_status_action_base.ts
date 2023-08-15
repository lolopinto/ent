/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { ID, PrivacyPolicy } from "@snowtop/ent";
import {
  Action,
  Changeset,
  ChangesetOptions,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { Event } from "../../..";
import { EventBuilder } from "./event_builder";
import schema from "../../../../schema/event_schema";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface ClearEventRsvpStatusInput {
  userID: ID;
  whatever?: boolean | null;
}

export type ClearEventRsvpStatusActionTriggers = (
  | Trigger<
      Event,
      EventBuilder<ClearEventRsvpStatusInput, Event>,
      ExampleViewerAlias,
      ClearEventRsvpStatusInput,
      Event
    >
  | Trigger<
      Event,
      EventBuilder<ClearEventRsvpStatusInput, Event>,
      ExampleViewerAlias,
      ClearEventRsvpStatusInput,
      Event
    >[]
)[];

export type ClearEventRsvpStatusActionObservers = Observer<
  Event,
  EventBuilder<ClearEventRsvpStatusInput, Event>,
  ExampleViewerAlias,
  ClearEventRsvpStatusInput,
  Event
>[];

export type ClearEventRsvpStatusActionValidators = Validator<
  Event,
  EventBuilder<ClearEventRsvpStatusInput, Event>,
  ExampleViewerAlias,
  ClearEventRsvpStatusInput,
  Event
>[];

export class ClearEventRsvpStatusActionBase
  implements
    Action<
      Event,
      EventBuilder<ClearEventRsvpStatusInput, Event>,
      ExampleViewerAlias,
      ClearEventRsvpStatusInput,
      Event
    >
{
  public readonly builder: EventBuilder<ClearEventRsvpStatusInput, Event>;
  public readonly viewer: ExampleViewerAlias;
  protected input: ClearEventRsvpStatusInput;
  protected readonly event: Event;

  constructor(
    viewer: ExampleViewerAlias,
    event: Event,
    input: ClearEventRsvpStatusInput,
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
    if (schema.defaultActionPrivacy === undefined) {
      throw new Error(
        `defaultActionPrivacy in schema Event is undefined. This is likely a bug in the codegen. Please file an issue.`,
      );
    }

    return typeof schema.defaultActionPrivacy === "function"
      ? schema.defaultActionPrivacy()
      : schema.defaultActionPrivacy;
  }

  getTriggers(): ClearEventRsvpStatusActionTriggers {
    return [];
  }

  getObservers(): ClearEventRsvpStatusActionObservers {
    return [];
  }

  getValidators(): ClearEventRsvpStatusActionValidators {
    return [];
  }

  getInput(): ClearEventRsvpStatusInput {
    return this.input;
  }

  async changeset(): Promise<Changeset> {
    return this.builder.build();
  }

  async changesetWithOptions_BETA(
    options: ChangesetOptions,
  ): Promise<Changeset> {
    return this.builder.buildWithOptions_BETA(options);
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<Event | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Event> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends ClearEventRsvpStatusActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      event: Event,
      input: ClearEventRsvpStatusInput,
    ) => T,
    viewer: ExampleViewerAlias,
    event: Event,
    input: ClearEventRsvpStatusInput,
  ): T {
    return new this(viewer, event, input);
  }

  static async saveXFromID<T extends ClearEventRsvpStatusActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      event: Event,
      input: ClearEventRsvpStatusInput,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
    input: ClearEventRsvpStatusInput,
  ): Promise<Event> {
    const event = await Event.loadX(viewer, id);
    return new this(viewer, event, input).saveX();
  }
}
