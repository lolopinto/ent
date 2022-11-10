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
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { Event, Guest, GuestData, GuestDataSource } from "src/ent/";
import { GuestDataBuilder } from "src/ent/generated/guest_data/actions/guest_data_builder";

export interface GuestDataCreateInput {
  guestID: ID | Builder<Guest, Viewer>;
  eventID: ID | Builder<Event, Viewer>;
  dietaryRestrictions: string;
  source?: GuestDataSource | null;
}

export type CreateGuestDataActionTriggers = (
  | Trigger<
      GuestData,
      GuestDataBuilder<GuestDataCreateInput, GuestData | null>,
      Viewer,
      GuestDataCreateInput,
      GuestData | null
    >
  | Trigger<
      GuestData,
      GuestDataBuilder<GuestDataCreateInput, GuestData | null>,
      Viewer,
      GuestDataCreateInput,
      GuestData | null
    >[]
)[];

export type CreateGuestDataActionObservers = Observer<
  GuestData,
  GuestDataBuilder<GuestDataCreateInput, GuestData | null>,
  Viewer,
  GuestDataCreateInput,
  GuestData | null
>[];

export type CreateGuestDataActionValidators = Validator<
  GuestData,
  GuestDataBuilder<GuestDataCreateInput, GuestData | null>,
  Viewer,
  GuestDataCreateInput,
  GuestData | null
>[];

export class CreateGuestDataActionBase
  implements
    Action<
      GuestData,
      GuestDataBuilder<GuestDataCreateInput, GuestData | null>,
      Viewer,
      GuestDataCreateInput,
      GuestData | null
    >
{
  public readonly builder: GuestDataBuilder<
    GuestDataCreateInput,
    GuestData | null
  >;
  public readonly viewer: Viewer;
  protected input: GuestDataCreateInput;

  constructor(viewer: Viewer, input: GuestDataCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new GuestDataBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
      null,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy<GuestData, Viewer> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): CreateGuestDataActionTriggers {
    return [];
  }

  getObservers(): CreateGuestDataActionObservers {
    return [];
  }

  getValidators(): CreateGuestDataActionValidators {
    return [];
  }

  getInput(): GuestDataCreateInput {
    return this.input;
  }

  async changeset(): Promise<Changeset> {
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
    this: new (
      viewer: Viewer,
      input: GuestDataCreateInput,
    ) => T,
    viewer: Viewer,
    input: GuestDataCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
