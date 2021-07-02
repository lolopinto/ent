// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/snowtop-ts";
import {
  Action,
  Builder,
  Changeset,
  WriteOperation,
} from "@snowtop/snowtop-ts/action";
import { Event, Guest, GuestGroup } from "src/ent/";
import { GuestBuilder, GuestInput } from "src/ent/guest/actions/guest_builder";

export interface GuestCreateInput {
  name: string;
  eventID: ID | Builder<Event>;
  emailAddress?: string | null;
  guestGroupID: ID | Builder<GuestGroup>;
  title?: string | null;
}

export class CreateGuestActionBase implements Action<Guest> {
  public readonly builder: GuestBuilder;
  public readonly viewer: Viewer;
  protected input: GuestCreateInput;

  constructor(viewer: Viewer, input: GuestCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new GuestBuilder(this.viewer, WriteOperation.Insert, this);
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): GuestInput {
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
    return await this.builder.editedEnt();
  }

  async saveX(): Promise<Guest> {
    await this.builder.saveX();
    return await this.builder.editedEntX();
  }

  static create<T extends CreateGuestActionBase>(
    this: new (viewer: Viewer, input: GuestCreateInput) => T,
    viewer: Viewer,
    input: GuestCreateInput,
  ): CreateGuestActionBase {
    return new this(viewer, input);
  }
}
