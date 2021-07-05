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
import {
  GuestDataBuilder,
  GuestDataInput,
} from "src/ent/guest_data/actions/guest_data_builder";

export interface GuestDataEditInput {
  guestID?: ID | Builder<Guest>;
  eventID?: ID | Builder<Event>;
  dietaryRestrictions?: string;
}

export class EditGuestDataActionBase implements Action<GuestData> {
  public readonly builder: GuestDataBuilder;
  public readonly viewer: Viewer;
  protected input: GuestDataEditInput;
  protected guestData: GuestData;

  constructor(viewer: Viewer, guestData: GuestData, input: GuestDataEditInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new GuestDataBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      guestData,
    );
    this.guestData = guestData;
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

  static create<T extends EditGuestDataActionBase>(
    this: new (
      viewer: Viewer,
      guestData: GuestData,
      input: GuestDataEditInput,
    ) => T,
    viewer: Viewer,
    guestData: GuestData,
    input: GuestDataEditInput,
  ): EditGuestDataActionBase {
    return new this(viewer, guestData, input);
  }

  static async saveXFromID<T extends EditGuestDataActionBase>(
    this: new (
      viewer: Viewer,
      guestData: GuestData,
      input: GuestDataEditInput,
    ) => T,
    viewer: Viewer,
    id: ID,
    input: GuestDataEditInput,
  ): Promise<GuestData> {
    let guestData = await GuestData.loadX(viewer, id);
    return await new this(viewer, guestData, input).saveX();
  }
}
