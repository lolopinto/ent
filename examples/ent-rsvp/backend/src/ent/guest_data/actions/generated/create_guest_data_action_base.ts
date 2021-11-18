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
import { Event, Guest, GuestData } from "src/ent/";
import { GuestDataBuilder } from "src/ent/guest_data/actions/generated/guest_data_builder";

export interface GuestDataCreateInput {
  guestID: ID | Builder<Guest>;
  eventID: ID | Builder<Event>;
  dietaryRestrictions: string;
}

export class CreateGuestDataActionBase
  implements
    Action<
      GuestData,
      GuestDataBuilder<GuestDataCreateInput>,
      GuestDataCreateInput
    >
{
  public readonly builder: GuestDataBuilder<GuestDataCreateInput>;
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

  getPrivacyPolicy(): PrivacyPolicy<GuestData> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): GuestDataCreateInput {
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
    return this.builder.editedEnt();
  }

  async saveX(): Promise<GuestData> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends CreateGuestDataActionBase>(
    this: new (viewer: Viewer, input: GuestDataCreateInput) => T,
    viewer: Viewer,
    input: GuestDataCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
