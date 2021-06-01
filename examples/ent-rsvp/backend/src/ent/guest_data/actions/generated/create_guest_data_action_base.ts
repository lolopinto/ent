// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@lolopinto/ent";
import {
  Action,
  Builder,
  Changeset,
  WriteOperation,
} from "@lolopinto/ent/action";
import { Event, Guest, GuestData } from "src/ent/";
import {
  GuestDataBuilder,
  GuestDataInput,
} from "src/ent/guest_data/actions/guest_data_builder";

export interface GuestDataCreateInput {
  guestID: ID | Builder<Guest>;
  eventID: ID | Builder<Event>;
  dietaryRestrictions: string;
}

export class CreateGuestDataActionBase implements Action<GuestData> {
  public readonly builder: GuestDataBuilder;
  public readonly viewer: Viewer;
  protected input: GuestDataCreateInput;

  constructor(viewer: Viewer, input: GuestDataCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new GuestDataBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): GuestDataInput {
    return this.input;
  }

  async changeset(): Promise<Changeset<GuestData>> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<GuestData | null> {
    await this.builder.save();
    return await this.builder.editedEnt();
  }

  async saveX(): Promise<GuestData> {
    await this.builder.saveX();
    return await this.builder.editedEntX();
  }

  static create<T extends CreateGuestDataActionBase>(
    this: new (viewer: Viewer, input: GuestDataCreateInput) => T,
    viewer: Viewer,
    input: GuestDataCreateInput,
  ): CreateGuestDataActionBase {
    return new this(viewer, input);
  }
}
