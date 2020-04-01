// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  Action,
  saveBuilder,
  saveBuilderX,
  WriteOperation,
  Changeset,
} from "ent/action";
import { Viewer } from "ent/ent";
import Event from "src/ent/event";
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

  getFields(): EventInput {
    return {
      requiredFields: [],
    };
  }

  async changeset(): Promise<Changeset<Event>> {
    return this.builder.build();
  }

  async save(): Promise<void> {
    await saveBuilder(this.builder);
  }

  async saveX(): Promise<void> {
    await saveBuilderX(this.builder);
  }

  static create<T extends DeleteEventActionBase>(
    this: new (viewer: Viewer, event: Event) => T,
    viewer: Viewer,
    event: Event,
  ): DeleteEventActionBase {
    return new this(viewer, event);
  }
}
