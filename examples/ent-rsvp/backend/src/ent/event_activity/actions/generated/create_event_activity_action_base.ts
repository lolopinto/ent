// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import {
  Action,
  Builder,
  Changeset,
  WriteOperation,
} from "@snowtop/ent/action";
import { Event, EventActivity } from "src/ent/";
import { EventActivityBuilder } from "src/ent/event_activity/actions/generated/event_activity_builder";

interface customAddressInput {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  apartment?: string | null;
}

export interface EventActivityCreateInput {
  name: string;
  eventID: ID | Builder<Event>;
  startTime: Date;
  endTime?: Date | null;
  location: string;
  description?: string | null;
  inviteAllGuests?: boolean;
  address?: customAddressInput | null;
}

export class CreateEventActivityActionBase
  implements
    Action<
      EventActivity,
      EventActivityBuilder<EventActivityCreateInput>,
      EventActivityCreateInput
    >
{
  public readonly builder: EventActivityBuilder<EventActivityCreateInput>;
  public readonly viewer: Viewer;
  protected input: EventActivityCreateInput;

  constructor(viewer: Viewer, input: EventActivityCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new EventActivityBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): EventActivityCreateInput {
    return this.input;
  }

  async changeset(): Promise<Changeset<EventActivity>> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<EventActivity | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<EventActivity> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends CreateEventActivityActionBase>(
    this: new (viewer: Viewer, input: EventActivityCreateInput) => T,
    viewer: Viewer,
    input: EventActivityCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
