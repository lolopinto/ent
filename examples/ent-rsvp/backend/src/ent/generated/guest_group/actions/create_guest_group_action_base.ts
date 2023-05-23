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
  ChangesetOptions,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { Address, Event, GuestGroup } from "src/ent/";
import { GuestGroupBuilder } from "src/ent/generated/guest_group/actions/guest_group_builder";

interface customGuestInput {
  addressId?: ID | null | Builder<Address, Viewer>;
  name: string;
  emailAddress?: string | null;
  title?: string | null;
}

export interface GuestGroupCreateInput {
  invitationName: string;
  eventID: ID | Builder<Event, Viewer>;
  guests?: customGuestInput[] | null;
}

export type CreateGuestGroupActionTriggers = (
  | Trigger<
      GuestGroup,
      GuestGroupBuilder<GuestGroupCreateInput, GuestGroup | null>,
      Viewer,
      GuestGroupCreateInput,
      GuestGroup | null
    >
  | Trigger<
      GuestGroup,
      GuestGroupBuilder<GuestGroupCreateInput, GuestGroup | null>,
      Viewer,
      GuestGroupCreateInput,
      GuestGroup | null
    >[]
)[];

export type CreateGuestGroupActionObservers = Observer<
  GuestGroup,
  GuestGroupBuilder<GuestGroupCreateInput, GuestGroup | null>,
  Viewer,
  GuestGroupCreateInput,
  GuestGroup | null
>[];

export type CreateGuestGroupActionValidators = Validator<
  GuestGroup,
  GuestGroupBuilder<GuestGroupCreateInput, GuestGroup | null>,
  Viewer,
  GuestGroupCreateInput,
  GuestGroup | null
>[];

export class CreateGuestGroupActionBase
  implements
    Action<
      GuestGroup,
      GuestGroupBuilder<GuestGroupCreateInput, GuestGroup | null>,
      Viewer,
      GuestGroupCreateInput,
      GuestGroup | null
    >
{
  public readonly builder: GuestGroupBuilder<
    GuestGroupCreateInput,
    GuestGroup | null
  >;
  public readonly viewer: Viewer;
  protected input: GuestGroupCreateInput;

  constructor(viewer: Viewer, input: GuestGroupCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new GuestGroupBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
      null,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy<GuestGroup, Viewer> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): CreateGuestGroupActionTriggers {
    return [];
  }

  getObservers(): CreateGuestGroupActionObservers {
    return [];
  }

  getValidators(): CreateGuestGroupActionValidators {
    return [];
  }

  getInput(): GuestGroupCreateInput {
    return this.input;
  }

  async changeset(): Promise<Changeset> {
    return this.builder.build();
  }

  async changesetWithOptions_BETA(
    options: ChangesetOptions,
  ): Promise<Changeset> {
    return this.builder.buildWithOptions_BETA(options);
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<GuestGroup | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<GuestGroup> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends CreateGuestGroupActionBase>(
    this: new (
      viewer: Viewer,
      input: GuestGroupCreateInput,
    ) => T,
    viewer: Viewer,
    input: GuestGroupCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
