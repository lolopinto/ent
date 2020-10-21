// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Action, WriteOperation, Changeset } from "@lolopinto/ent/action";
import { Viewer, ID } from "@lolopinto/ent";
import { Event } from "src/ent/";
import { EventBuilder, EventInput } from "src/ent/event/actions/event_builder";

export class DeleteEventActionBase implements Action<Event> {
  public readonly builder: EventBuilder;
  public readonly viewer: Viewer;

  constructor(viewer: Viewer, event: Event) {
    this.viewer = viewer;
    this.builder = new EventBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      event,
    );
  }

  getInput(): EventInput {
    return {};
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

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  static create<T extends DeleteEventActionBase>(
    this: new (viewer: Viewer, event: Event) => T,
    viewer: Viewer,
    event: Event,
  ): DeleteEventActionBase {
    return new this(viewer, event);
  }

  static async saveXFromID<T extends DeleteEventActionBase>(
    this: new (viewer: Viewer, event: Event) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    let event = await Event.loadX(viewer, id);
    return await new this(viewer, event).saveX();
  }
}
