/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  PrivacyPolicy,
} from "@snowtop/ent";
import {
  Action,
  Changeset,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { Address } from "../../..";
import { AddressBuilder } from "./address_builder";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface AddressCreateInput {
  streetName: string;
  city: string;
  state: string;
  zip: string;
  apartment?: string | null;
  country?: string;
}

export class CreateAddressActionBase
  implements
    Action<
      Address,
      AddressBuilder<AddressCreateInput, Address | null>,
      ExampleViewerAlias,
      AddressCreateInput,
      Address | null
    >
{
  public readonly builder: AddressBuilder<AddressCreateInput, Address | null>;
  public readonly viewer: ExampleViewerAlias;
  protected input: AddressCreateInput;

  constructor(viewer: ExampleViewerAlias, input: AddressCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new AddressBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
      null,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy<Address> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): Trigger<
    Address,
    AddressBuilder<AddressCreateInput, Address | null>,
    ExampleViewerAlias,
    AddressCreateInput,
    Address | null
  >[] {
    return [];
  }

  getObservers(): Observer<
    Address,
    AddressBuilder<AddressCreateInput, Address | null>,
    ExampleViewerAlias,
    AddressCreateInput,
    Address | null
  >[] {
    return [];
  }

  getValidators(): Validator<
    Address,
    AddressBuilder<AddressCreateInput, Address | null>,
    ExampleViewerAlias,
    AddressCreateInput,
    Address | null
  >[] {
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
    this: new (viewer: ExampleViewerAlias, input: AddressCreateInput) => T,
    viewer: ExampleViewerAlias,
    input: AddressCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
