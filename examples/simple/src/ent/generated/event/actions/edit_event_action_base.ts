/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import { ID, PrivacyPolicy } from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  ChangesetOptions,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { Address, Event } from "../../..";
import { EventBuilder } from "./event_builder";
import schema from "../../../../schema/event_schema";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface EventEditInput {
  name?: string;
  startTime?: Date;
  endTime?: Date | null;
  location?: string;
  addressID?: ID | null | Builder<Address, ExampleViewerAlias>;
}

export type EditEventActionTriggers = (
  | Trigger<
      Event,
      EventBuilder<EventEditInput, Event>,
      ExampleViewerAlias,
      EventEditInput,
      Event
    >
  | Trigger<
      Event,
      EventBuilder<EventEditInput, Event>,
      ExampleViewerAlias,
      EventEditInput,
      Event
    >[]
)[];

export type EditEventActionObservers = Observer<
  Event,
  EventBuilder<EventEditInput, Event>,
  ExampleViewerAlias,
  EventEditInput,
  Event
>[];

export type EditEventActionValidators = Validator<
  Event,
  EventBuilder<EventEditInput, Event>,
  ExampleViewerAlias,
  EventEditInput,
  Event
>[];

export class EditEventActionBase
  implements
    Action<
      Event,
      EventBuilder<EventEditInput, Event>,
      ExampleViewerAlias,
      EventEditInput,
      Event
    >
{
  public readonly builder: EventBuilder<EventEditInput, Event>;
  public readonly viewer: ExampleViewerAlias;
  protected input: EventEditInput;
  protected readonly event: Event;

  constructor(viewer: ExampleViewerAlias, event: Event, input: EventEditInput) {
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

  getTriggers(): EditEventActionTriggers {
    return [];
  }

  getObservers(): EditEventActionObservers {
    return [];
  }

  getValidators(): EditEventActionValidators {
    return [];
  }

  getInput(): EventEditInput {
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

  static create<T extends EditEventActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      event: Event,
      input: EventEditInput,
    ) => T,
    viewer: ExampleViewerAlias,
    event: Event,
    input: EventEditInput,
  ): T {
    return new this(viewer, event, input);
  }

  static async saveXFromID<T extends EditEventActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      event: Event,
      input: EventEditInput,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
    input: EventEditInput,
  ): Promise<Event> {
    const event = await Event.loadX(viewer, id);
    return new this(viewer, event, input).saveX();
  }
}
