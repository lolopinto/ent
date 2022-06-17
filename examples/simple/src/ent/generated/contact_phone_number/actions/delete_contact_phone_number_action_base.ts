/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerHasIdentityPrivacyPolicy,
  ID,
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
import { ContactPhoneNumber } from "../../..";
import {
  ContactPhoneNumberBuilder,
  ContactPhoneNumberInput,
} from "./contact_phone_number_builder";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export class DeleteContactPhoneNumberActionBase
  implements
    Action<
      ContactPhoneNumber,
      ContactPhoneNumberBuilder<ContactPhoneNumberInput, ContactPhoneNumber>,
      ExampleViewerAlias,
      ContactPhoneNumberInput,
      ContactPhoneNumber
    >
{
  public readonly builder: ContactPhoneNumberBuilder<
    ContactPhoneNumberInput,
    ContactPhoneNumber
  >;
  public readonly viewer: ExampleViewerAlias;
  protected readonly contactPhoneNumber: ContactPhoneNumber;

  constructor(
    viewer: ExampleViewerAlias,
    contactPhoneNumber: ContactPhoneNumber,
  ) {
    this.viewer = viewer;
    this.builder = new ContactPhoneNumberBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      contactPhoneNumber,
    );
    this.contactPhoneNumber = contactPhoneNumber;
  }

  getPrivacyPolicy(): PrivacyPolicy<ContactPhoneNumber> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): Trigger<
    ContactPhoneNumber,
    ContactPhoneNumberBuilder<ContactPhoneNumberInput, ContactPhoneNumber>,
    ExampleViewerAlias,
    ContactPhoneNumberInput,
    ContactPhoneNumber
  >[] {
    return [];
  }

  getObservers(): Observer<
    ContactPhoneNumber,
    ContactPhoneNumberBuilder<ContactPhoneNumberInput, ContactPhoneNumber>,
    ExampleViewerAlias,
    ContactPhoneNumberInput,
    ContactPhoneNumber
  >[] {
    return [];
  }

  getValidators(): Validator<
    ContactPhoneNumber,
    ContactPhoneNumberBuilder<ContactPhoneNumberInput, ContactPhoneNumber>,
    ExampleViewerAlias,
    ContactPhoneNumberInput,
    ContactPhoneNumber
  >[] {
    return [];
  }

  getInput(): ContactPhoneNumberInput {
    return {};
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

  async save(): Promise<void> {
    await this.builder.save();
  }

  async saveX(): Promise<void> {
    await this.builder.saveX();
  }

  static create<T extends DeleteContactPhoneNumberActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      contactPhoneNumber: ContactPhoneNumber,
    ) => T,
    viewer: ExampleViewerAlias,
    contactPhoneNumber: ContactPhoneNumber,
  ): T {
    return new this(viewer, contactPhoneNumber);
  }

  static async saveXFromID<T extends DeleteContactPhoneNumberActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      contactPhoneNumber: ContactPhoneNumber,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
  ): Promise<void> {
    const contactPhoneNumber = await ContactPhoneNumber.loadX(viewer, id);
    return new this(viewer, contactPhoneNumber).saveX();
  }
}
