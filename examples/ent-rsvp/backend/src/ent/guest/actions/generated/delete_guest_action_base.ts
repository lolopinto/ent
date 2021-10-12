// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { Guest } from "src/ent/";
import {
  GuestBuilder,
  GuestInput,
} from "src/ent/guest/actions/generated/guest_builder";

export class DeleteGuestActionBase implements Action<Guest> {
  public readonly builder: GuestBuilder;
  public readonly viewer: Viewer;
  protected guest: Guest;

  constructor(viewer: Viewer, guest: Guest) {
    this.viewer = viewer;
    this.builder = new GuestBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      guest,
    );
    this.guest = guest;
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): GuestInput {
    return {};
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

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  static create<T extends DeleteGuestActionBase>(
    this: new (viewer: Viewer, guest: Guest) => T,
    viewer: Viewer,
    guest: Guest,
  ): DeleteGuestActionBase {
    return new this(viewer, guest);
  }

  static async saveXFromID<T extends DeleteGuestActionBase>(
    this: new (viewer: Viewer, guest: Guest) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    const guest = await Guest.loadX(viewer, id);
    return await new this(viewer, guest).saveX();
  }
}
