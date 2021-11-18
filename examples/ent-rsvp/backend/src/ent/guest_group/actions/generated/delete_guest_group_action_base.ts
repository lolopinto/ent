// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
  PrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { GuestGroup } from "src/ent/";
import {
  GuestGroupBuilder,
  GuestGroupInput,
} from "src/ent/guest_group/actions/generated/guest_group_builder";

export class DeleteGuestGroupActionBase
  implements
    Action<GuestGroup, GuestGroupBuilder<GuestGroupInput>, GuestGroupInput>
{
  public readonly builder: GuestGroupBuilder<GuestGroupInput>;
  public readonly viewer: Viewer;
  protected guestGroup: GuestGroup;

  constructor(viewer: Viewer, guestGroup: GuestGroup) {
    this.viewer = viewer;
    this.builder = new GuestGroupBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      guestGroup,
    );
    this.guestGroup = guestGroup;
  }

  getPrivacyPolicy(): PrivacyPolicy<GuestGroup> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): GuestGroupInput {
    return {};
  }

  async changeset(): Promise<Changeset<GuestGroup>> {
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

  static create<T extends DeleteGuestGroupActionBase>(
    this: new (viewer: Viewer, guestGroup: GuestGroup) => T,
    viewer: Viewer,
    guestGroup: GuestGroup,
  ): T {
    return new this(viewer, guestGroup);
  }

  static async saveXFromID<T extends DeleteGuestGroupActionBase>(
    this: new (viewer: Viewer, guestGroup: GuestGroup) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    const guestGroup = await GuestGroup.loadX(viewer, id);
    return new this(viewer, guestGroup).saveX();
  }
}
