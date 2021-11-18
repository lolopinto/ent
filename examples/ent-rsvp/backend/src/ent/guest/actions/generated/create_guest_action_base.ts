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
import { Event, Guest, GuestGroup } from "src/ent/";
import { GuestBuilder } from "src/ent/guest/actions/generated/guest_builder";

export interface GuestCreateInput {
  name: string;
  eventID: ID | Builder<Event>;
  emailAddress?: string | null;
  guestGroupID: ID | Builder<GuestGroup>;
  title?: string | null;
}

export class CreateGuestActionBase
  implements Action<Guest, GuestBuilder<GuestCreateInput>, GuestCreateInput>
{
  public readonly builder: GuestBuilder<GuestCreateInput>;
  public readonly viewer: Viewer;
  protected input: GuestCreateInput;

  constructor(viewer: Viewer, input: GuestCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new GuestBuilder(this.viewer, WriteOperation.Insert, this);
  }

  getPrivacyPolicy(): PrivacyPolicy<Guest> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): GuestCreateInput {
    return this.input;
  }

  async changeset(): Promise<Changeset<Guest>> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<Guest | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Guest> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends CreateGuestActionBase>(
    this: new (viewer: Viewer, input: GuestCreateInput) => T,
    viewer: Viewer,
    input: GuestCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
