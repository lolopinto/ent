/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

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
  WriteOperation,
} from "@snowtop/ent/action";
import { Contact, ContactPhoneNumber } from "../../..";
import {
  ContactPhoneNumberBuilder,
  ContactPhoneNumberInput,
} from "./contact_phone_number_builder";

export interface ContactPhoneNumberEditInput {
  phoneNumber?: string;
  label?: string;
  contactID?: ID | Builder<Contact>;
}

export class EditContactPhoneNumberActionBase
  implements Action<ContactPhoneNumber>
{
  public readonly builder: ContactPhoneNumberBuilder;
  public readonly viewer: Viewer;
  protected input: ContactPhoneNumberEditInput;
  protected contactPhoneNumber: ContactPhoneNumber;

  constructor(
    viewer: Viewer,
    contactPhoneNumber: ContactPhoneNumber,
    input: ContactPhoneNumberEditInput,
  ) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new ContactPhoneNumberBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      contactPhoneNumber,
    );
    this.contactPhoneNumber = contactPhoneNumber;
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): ContactPhoneNumberInput {
    return this.input;
  }

  async changeset(): Promise<Changeset<ContactPhoneNumber>> {
    return this.builder.build();
  }

  async valid(): Promise<boolean> {
    return this.builder.valid();
  }

  async validX(): Promise<void> {
    await this.builder.validX();
  }

  async save(): Promise<ContactPhoneNumber | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<ContactPhoneNumber> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends EditContactPhoneNumberActionBase>(
    this: new (
      viewer: Viewer,
      contactPhoneNumber: ContactPhoneNumber,
      input: ContactPhoneNumberEditInput,
    ) => T,
    viewer: Viewer,
    contactPhoneNumber: ContactPhoneNumber,
    input: ContactPhoneNumberEditInput,
  ): T {
    return new this(viewer, contactPhoneNumber, input);
  }

  static async saveXFromID<T extends EditContactPhoneNumberActionBase>(
    this: new (
      viewer: Viewer,
      contactPhoneNumber: ContactPhoneNumber,
      input: ContactPhoneNumberEditInput,
    ) => T,
    viewer: Viewer,
    id: ID,
    input: ContactPhoneNumberEditInput,
  ): Promise<ContactPhoneNumber> {
    const contactPhoneNumber = await ContactPhoneNumber.loadX(viewer, id);
    return new this(viewer, contactPhoneNumber, input).saveX();
  }
}
