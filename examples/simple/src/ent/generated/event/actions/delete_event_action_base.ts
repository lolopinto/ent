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
} from "@snowtop/ent/action";
import { Event } from "../../..";
import { EventBuilder, EventInput } from "./event_builder";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export type DeleteEventActionTriggers = (
  | Trigger<
      Event,
      EventBuilder<EventInput, Event>,
      ExampleViewerAlias,
      EventInput,
      Event
    >
  | Trigger<
      Event,
      EventBuilder<EventInput, Event>,
      ExampleViewerAlias,
      EventInput,
      Event
    >[]
)[];

export type DeleteEventActionObservers = Observer<
  Event,
  EventBuilder<EventInput, Event>,
  ExampleViewerAlias,
  EventInput,
  Event
>[];

export type DeleteEventActionValidators = Validator<
  Event,
  EventBuilder<EventInput, Event>,
  ExampleViewerAlias,
  EventInput,
  Event
>[];

export class DeleteEventActionBase
  implements
    Action<
      Event,
      EventBuilder<EventInput, Event>,
      ExampleViewerAlias,
      EventInput,
      Event
    >
{
  public readonly builder: EventBuilder<EventInput, Event>;
  public readonly viewer: ExampleViewerAlias;
  protected readonly event: Event;

  constructor(viewer: ExampleViewerAlias, event: Event) {
    this.viewer = viewer;
    this.builder = new EventBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      event,
    );
    this.event = event;
  }

  getPrivacyPolicy(): PrivacyPolicy<Event, ExampleViewerAlias> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): DeleteEventActionTriggers {
    return [];
  }

  getObservers(): DeleteEventActionObservers {
    return [];
  }

  getValidators(): DeleteEventActionValidators {
    return [];
  }

  getInput(): EventInput {
    return {};
  }

  async changeset(): Promise<Changeset> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  static create<T extends DeleteEventActionBase>(
    this: new (viewer: ExampleViewerAlias, event: Event) => T,
    viewer: ExampleViewerAlias,
    event: Event,
  ): T {
    return new this(viewer, event);
  }

  static async saveXFromID<T extends DeleteEventActionBase>(
    this: new (viewer: ExampleViewerAlias, event: Event) => T,
    viewer: ExampleViewerAlias,
    id: ID,
  ): Promise<void> {
    const event = await Event.loadX(viewer, id);
    return new this(viewer, event).saveX();
  }
}
