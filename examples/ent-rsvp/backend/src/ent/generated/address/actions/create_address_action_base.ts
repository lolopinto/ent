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
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { Address } from "src/ent/";
import { AddressBuilder } from "src/ent/generated/address/actions/address_builder";

export interface AddressCreateInput {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  apartment?: string | null;
  ownerID: ID | Builder<Ent<Viewer>, Viewer>;
  ownerType: string;
}

export type CreateAddressActionTriggers = (
  | Trigger<
      Address,
      AddressBuilder<AddressCreateInput, Address | null>,
      Viewer,
      AddressCreateInput,
      Address | null
    >
  | Trigger<
      Address,
      AddressBuilder<AddressCreateInput, Address | null>,
      Viewer,
      AddressCreateInput,
      Address | null
    >[]
)[];

export type CreateAddressActionObservers = Observer<
  Address,
  AddressBuilder<AddressCreateInput, Address | null>,
  Viewer,
  AddressCreateInput,
  Address | null
>[];

export type CreateAddressActionValidators = Validator<
  Address,
  AddressBuilder<AddressCreateInput, Address | null>,
  Viewer,
  AddressCreateInput,
  Address | null
>[];

export class CreateAddressActionBase
  implements
    Action<
      Address,
      AddressBuilder<AddressCreateInput, Address | null>,
      Viewer,
      AddressCreateInput,
      Address | null
    >
{
  public readonly builder: AddressBuilder<AddressCreateInput, Address | null>;
  public readonly viewer: Viewer;
  protected input: AddressCreateInput;

  constructor(viewer: Viewer, input: AddressCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new AddressBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
      null,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy<Address, Viewer> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): CreateAddressActionTriggers {
    return [];
  }

  getObservers(): CreateAddressActionObservers {
    return [];
  }

  getValidators(): CreateAddressActionValidators {
    return [];
  }

  getInput(): AddressCreateInput {
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

  async save(): Promise<Address | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Address> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends CreateAddressActionBase>(
    this: new (
      viewer: Viewer,
      input: AddressCreateInput,
    ) => T,
    viewer: Viewer,
    input: AddressCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
