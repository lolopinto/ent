// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  Ent,
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
import { Address } from "src/ent/";
import { AddressBuilder } from "src/ent/generated/address/actions/address_builder";

export interface AddressEditInput {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  apartment?: string | null;
  ownerID?: ID | Builder<Ent<Viewer>, Viewer>;
  ownerType?: string;
}

export type EditAddressActionTriggers = (
  | Trigger<
      Address,
      AddressBuilder<AddressEditInput, Address>,
      Viewer,
      AddressEditInput,
      Address
    >
  | Trigger<
      Address,
      AddressBuilder<AddressEditInput, Address>,
      Viewer,
      AddressEditInput,
      Address
    >[]
)[];

export type EditAddressActionObservers = Observer<
  Address,
  AddressBuilder<AddressEditInput, Address>,
  Viewer,
  AddressEditInput,
  Address
>[];

export type EditAddressActionValidators = Validator<
  Address,
  AddressBuilder<AddressEditInput, Address>,
  Viewer,
  AddressEditInput,
  Address
>[];

export class EditAddressActionBase
  implements
    Action<
      Address,
      AddressBuilder<AddressEditInput, Address>,
      Viewer,
      AddressEditInput,
      Address
    >
{
  public readonly builder: AddressBuilder<AddressEditInput, Address>;
  public readonly viewer: Viewer;
  protected input: AddressEditInput;
  protected readonly address: Address;

  constructor(viewer: Viewer, address: Address, input: AddressEditInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new AddressBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      address,
    );
    this.address = address;
  }

  getPrivacyPolicy(): PrivacyPolicy<Address, Viewer> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): EditAddressActionTriggers {
    return [];
  }

  getObservers(): EditAddressActionObservers {
    return [];
  }

  getValidators(): EditAddressActionValidators {
    return [];
  }

  getInput(): AddressEditInput {
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

  async save(): Promise<Address | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Address> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends EditAddressActionBase>(
    this: new (
      viewer: Viewer,
      address: Address,
      input: AddressEditInput,
    ) => T,
    viewer: Viewer,
    address: Address,
    input: AddressEditInput,
  ): T {
    return new this(viewer, address, input);
  }

  static async saveXFromID<T extends EditAddressActionBase>(
    this: new (
      viewer: Viewer,
      address: Address,
      input: AddressEditInput,
    ) => T,
    viewer: Viewer,
    id: ID,
    input: AddressEditInput,
  ): Promise<Address> {
    const address = await Address.loadX(viewer, id);
    return new this(viewer, address, input).saveX();
  }
}
