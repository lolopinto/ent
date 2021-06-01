// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  Viewer,
  ID,
  AllowIfViewerHasIdentityPrivacyPolicy,
  PrivacyPolicy,
} from "@lolopinto/ent";
import { Action, WriteOperation, Changeset } from "@lolopinto/ent/action";
import { Address } from "src/ent/";
import {
  AddressBuilder,
  AddressInput,
} from "src/ent/address/actions/address_builder";

export class DeleteAddressActionBase implements Action<Address> {
  public readonly builder: AddressBuilder;
  public readonly viewer: Viewer;
  protected address: Address;

  constructor(viewer: Viewer, address: Address) {
    this.viewer = viewer;
    this.builder = new AddressBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      address,
    );
    this.address = address;
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): AddressInput {
    return {};
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

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  static create<T extends DeleteAddressActionBase>(
    this: new (viewer: Viewer, address: Address) => T,
    viewer: Viewer,
    address: Address,
  ): DeleteAddressActionBase {
    return new this(viewer, address);
  }

  static async saveXFromID<T extends DeleteAddressActionBase>(
    this: new (viewer: Viewer, address: Address) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    let address = await Address.loadX(viewer, id);
    return await new this(viewer, address).saveX();
  }
}
