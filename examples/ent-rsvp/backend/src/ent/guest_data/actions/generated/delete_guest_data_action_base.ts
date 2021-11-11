// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { GuestData } from "src/ent/";
import {
  GuestDataBuilder,
  GuestDataInput,
} from "src/ent/guest_data/actions/generated/guest_data_builder";

export class DeleteGuestDataActionBase
  implements
    Action<GuestData, GuestDataBuilder<GuestDataInput>, GuestDataInput>
{
  public readonly builder: GuestDataBuilder<GuestDataInput>;
  public readonly viewer: Viewer;
  protected guestData: GuestData;

  constructor(viewer: Viewer, guestData: GuestData) {
    this.viewer = viewer;
    this.builder = new GuestDataBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      guestData,
    );
    this.guestData = guestData;
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): GuestDataInput {
    return {};
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

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  static create<T extends DeleteGuestDataActionBase>(
    this: new (viewer: Viewer, guestData: GuestData) => T,
    viewer: Viewer,
    guestData: GuestData,
  ): T {
    return new this(viewer, guestData);
  }

  static async saveXFromID<T extends DeleteGuestDataActionBase>(
    this: new (viewer: Viewer, guestData: GuestData) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    const guestData = await GuestData.loadX(viewer, id);
    return new this(viewer, guestData).saveX();
  }
}
