// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { Action, WriteOperation, Changeset } from "@lolopinto/ent/action";
import {
  Viewer,
  ID,
  AllowIfViewerHasIdentityPrivacyPolicy,
  PrivacyPolicy,
} from "@lolopinto/ent";
import { Event, User } from "src/ent/";
import { EventBuilder, EventInput } from "src/ent/event/actions/event_builder";

export class EventRemoveHostActionBase implements Action<Event> {
  public readonly builder: EventBuilder;
  public readonly viewer: Viewer;

  constructor(viewer: Viewer, event: Event) {
    this.viewer = viewer;
    this.builder = new EventBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      event,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): EventInput {
    return {};
  }

  removeHost(...ids: ID[]): this;
  removeHost(...nodes: User[]): this;
  removeHost(...nodes: ID[] | User[]): this {
    nodes.forEach((node) => this.builder.removeHost(node));
    return this;
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
    await this.builder.save();
    return await this.builder.editedEnt();
  }

  async saveX(): Promise<Event> {
    await this.builder.saveX();
    return await this.builder.editedEntX();
  }

  static create<T extends EventRemoveHostActionBase>(
    this: new (viewer: Viewer, event: Event) => T,
    viewer: Viewer,
    event: Event,
  ): EventRemoveHostActionBase {
    return new this(viewer, event);
  }

  static async saveXFromID<T extends EventRemoveHostActionBase>(
    this: new (viewer: Viewer, event: Event) => T,
    viewer: Viewer,
    id: ID,
    hostID: ID,
  ): Promise<Event> {
    let event = await Event.loadX(viewer, id);
    return await new this(viewer, event).removeHost(hostID).saveX();
  }
}
