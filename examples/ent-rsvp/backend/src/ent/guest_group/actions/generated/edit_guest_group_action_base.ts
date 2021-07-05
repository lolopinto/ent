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
} from "src/ent/guest_group/actions/guest_group_builder";

export interface GuestGroupEditInput {
  invitationName?: string;
}

export class EditGuestGroupActionBase implements Action<GuestGroup> {
  public readonly builder: GuestGroupBuilder;
  public readonly viewer: Viewer;
  protected input: GuestGroupEditInput;
  protected guestGroup: GuestGroup;

  constructor(
    viewer: Viewer,
    guestGroup: GuestGroup,
    input: GuestGroupEditInput,
  ) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new GuestGroupBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      guestGroup,
    );
    this.guestGroup = guestGroup;
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): GuestGroupInput {
    return this.input;
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

  async save(): Promise<GuestGroup | null> {
    await this.builder.save();
    return await this.builder.editedEnt();
  }

  async saveX(): Promise<GuestGroup> {
    await this.builder.saveX();
    return await this.builder.editedEntX();
  }

  static create<T extends EditGuestGroupActionBase>(
    this: new (
      viewer: Viewer,
      guestGroup: GuestGroup,
      input: GuestGroupEditInput,
    ) => T,
    viewer: Viewer,
    guestGroup: GuestGroup,
    input: GuestGroupEditInput,
  ): EditGuestGroupActionBase {
    return new this(viewer, guestGroup, input);
  }

  static async saveXFromID<T extends EditGuestGroupActionBase>(
    this: new (
      viewer: Viewer,
      guestGroup: GuestGroup,
      input: GuestGroupEditInput,
    ) => T,
    viewer: Viewer,
    id: ID,
    input: GuestGroupEditInput,
  ): Promise<GuestGroup> {
    let guestGroup = await GuestGroup.loadX(viewer, id);
    return await new this(viewer, guestGroup, input).saveX();
  }
}
