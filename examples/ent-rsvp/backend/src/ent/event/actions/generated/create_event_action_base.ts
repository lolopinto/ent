// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  Viewer,
  ID,
  AllowIfViewerHasIdentityPrivacyPolicy,
  PrivacyPolicy,
} from "@lolopinto/ent";
import {
  Action,
  Builder,
  WriteOperation,
  Changeset,
} from "@lolopinto/ent/action";
import { Event, User } from "src/ent/";
import { EventBuilder, EventInput } from "src/ent/event/actions/event_builder";

interface customActivityInput {
  name: string;
  startTime: Date;
  endTime?: Date | null;
  location: string;
  description?: string | null;
  inviteAllGuests?: boolean;
  address?: customAddressInput | null;
}

interface customAddressInput {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  apartment?: string | null;
}

export interface EventCreateInput {
  name: string;
  slug?: string | null;
  creatorID: ID | Builder<User>;
  activities?: customActivityInput[] | null;
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
    return AllowIfViewerHasIdentityPrivacyPolicy;
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
