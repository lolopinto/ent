// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  Action,
  saveBuilder,
  saveBuilderX,
  WriteOperation,
  Changeset,
} from "ent/action";
import { Viewer, ID } from "ent/ent";
import Event from "src/ent/event";
import { EventBuilder, EventInput } from "src/ent/event/actions/event_builder";

export interface EventCreateInput {
  name: string;
  creatorID: ID;
  startTime: Date;
  endTime?: Date | null;
  location: string;
}

export class CreateEventActionBase implements Action<Event> {
  public readonly builder: EventBuilder;
  public readonly viewer: Viewer;
  private input: EventCreateInput;

  constructor(viewer: Viewer, input: EventCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new EventBuilder(this.viewer, WriteOperation.Insert, this);
  }

  getInput(): EventInput {
    return {
      ...this.input,
      requiredFields: ["name", "creatorID", "start_time", "location"],
    };
  }

  async changeset(): Promise<Changeset<Event>> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<Event | null> {
    return await saveBuilder(this.builder);
  }

  async saveX(): Promise<Event> {
    return await saveBuilderX(this.builder);
  }

  static create<T extends CreateEventActionBase>(
    this: new (viewer: Viewer, input: EventCreateInput) => T,
    viewer: Viewer,
    input: EventCreateInput,
  ): CreateEventActionBase {
    return new this(viewer, input);
  }
}
