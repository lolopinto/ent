// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  Viewer,
  ID,
  Ent,
  AllowIfViewerHasIdentityPrivacyPolicy,
  PrivacyPolicy,
} from "@lolopinto/ent";
import {
  Action,
  Builder,
  WriteOperation,
  Changeset,
} from "@lolopinto/ent/action";
import { Address } from "src/ent/";
import {
  AddressBuilder,
  AddressInput,
} from "src/ent/address/actions/address_builder";

export interface AddressCreateInput {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  apartment?: string | null;
  ownerID: ID | Builder<Ent>;
  ownerType: string;
}

export class CreateAddressActionBase implements Action<Address> {
  public readonly builder: AddressBuilder;
  public readonly viewer: Viewer;
  protected input: AddressCreateInput;

  constructor(viewer: Viewer, input: AddressCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new AddressBuilder(this.viewer, WriteOperation.Insert, this);
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): AddressInput {
    return this.input;
  }

  async changeset(): Promise<Changeset<Address>> {
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
    return await this.builder.editedEnt();
  }

  async saveX(): Promise<Address> {
    await this.builder.saveX();
    return await this.builder.editedEntX();
  }

  static create<T extends CreateAddressActionBase>(
    this: new (viewer: Viewer, input: AddressCreateInput) => T,
    viewer: Viewer,
    input: AddressCreateInput,
  ): CreateAddressActionBase {
    return new this(viewer, input);
  }
}
