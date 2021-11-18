/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { Event, User } from "../../..";
import { EventBuilder, EventInput } from "./event_builder";

export class EventRemoveHostActionBase
  implements Action<Event, EventBuilder<EventInput>, EventInput>
{
  public readonly builder: EventBuilder<EventInput>;
  public readonly viewer: Viewer;
  protected event: Event;

  constructor(viewer: Viewer, event: Event) {
    this.viewer = viewer;
    this.builder = new EventBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      event,
    );
    this.event = event;
  }

  getPrivacyPolicy(): PrivacyPolicy<Event> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): EventInput {
    return {};
  }

  removeHost(...nodes: (ID | User)[]): this {
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
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Event> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends EventRemoveHostActionBase>(
    this: new (viewer: Viewer, event: Event) => T,
    viewer: Viewer,
    event: Event,
  ): T {
    return new this(viewer, event);
  }

  static async saveXFromID<T extends EventRemoveHostActionBase>(
    this: new (viewer: Viewer, event: Event) => T,
    viewer: Viewer,
    id: ID,
    hostID: ID,
  ): Promise<Event> {
    const event = await Event.loadX(viewer, id);
    return new this(viewer, event).removeHost(hostID).saveX();
  }
}
