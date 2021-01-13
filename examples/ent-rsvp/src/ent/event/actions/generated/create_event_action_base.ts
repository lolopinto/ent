// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  Action,
  Builder,
  WriteOperation,
  Changeset,
} from "@lolopinto/ent/action";
import {
  Viewer,
  ID,
  AllowIfHasIdentity,
  PrivacyPolicy,
  AlwaysDenyRule,
} from "@lolopinto/ent";
import { Event, User } from "src/ent/";
import { EventBuilder, EventInput } from "src/ent/event/actions/event_builder";

interface customAddressInput {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  apartment?: string | null;
}

export interface EventCreateInput {
  name: string;
  creatorID: ID | Builder<User>;
  address?: customAddressInput | null;
}

export class CreateEventActionBase implements Action<Event> {
  public readonly builder: EventBuilder;
  public readonly viewer: Viewer;
  protected input: EventCreateInput;

  constructor(viewer: Viewer, input: EventCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new EventBuilder(this.viewer, WriteOperation.Insert, this);
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [AllowIfHasIdentity, AlwaysDenyRule],
    };
  }

  getInput(): EventInput {
    return this.input;
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

  static create<T extends CreateEventActionBase>(
    this: new (viewer: Viewer, input: EventCreateInput) => T,
    viewer: Viewer,
    input: EventCreateInput,
  ): CreateEventActionBase {
    return new this(viewer, input);
  }
}
