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
  Builder,
  Changeset,
  Observer,
  Trigger,
  Validator,
  WriteOperation,
} from "@snowtop/ent/action";
import { Contact, ContactPhoneNumber } from "../../..";
import { ContactInfo } from "../../contact_info";
import { ContactPhoneNumberBuilder } from "./contact_phone_number_builder";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface ContactPhoneNumberEditInput {
  extra?: ContactInfo | null;
  phoneNumber?: string;
  label?: string;
  contactID?: ID | Builder<Contact, ExampleViewerAlias>;
}

export type EditContactPhoneNumberActionTriggers = (
  | Trigger<
      ContactPhoneNumber,
      ContactPhoneNumberBuilder<
        ContactPhoneNumberEditInput,
        ContactPhoneNumber
      >,
      ExampleViewerAlias,
      ContactPhoneNumberEditInput,
      ContactPhoneNumber
    >
  | Trigger<
      ContactPhoneNumber,
      ContactPhoneNumberBuilder<
        ContactPhoneNumberEditInput,
        ContactPhoneNumber
      >,
      ExampleViewerAlias,
      ContactPhoneNumberEditInput,
      ContactPhoneNumber
    >[]
)[];

export type EditContactPhoneNumberActionObservers = Observer<
  ContactPhoneNumber,
  ContactPhoneNumberBuilder<ContactPhoneNumberEditInput, ContactPhoneNumber>,
  ExampleViewerAlias,
  ContactPhoneNumberEditInput,
  ContactPhoneNumber
>[];

export type EditContactPhoneNumberActionValidators = Validator<
  ContactPhoneNumber,
  ContactPhoneNumberBuilder<ContactPhoneNumberEditInput, ContactPhoneNumber>,
  ExampleViewerAlias,
  ContactPhoneNumberEditInput,
  ContactPhoneNumber
>[];

export class EditContactPhoneNumberActionBase
  implements
    Action<
      ContactPhoneNumber,
      ContactPhoneNumberBuilder<
        ContactPhoneNumberEditInput,
        ContactPhoneNumber
      >,
      ExampleViewerAlias,
      ContactPhoneNumberEditInput,
      ContactPhoneNumber
    >
{
  public readonly builder: ContactPhoneNumberBuilder<
    ContactPhoneNumberEditInput,
    ContactPhoneNumber
  >;
  public readonly viewer: ExampleViewerAlias;
  protected input: ContactPhoneNumberEditInput;
  protected readonly contactPhoneNumber: ContactPhoneNumber;

  constructor(
    viewer: ExampleViewerAlias,
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

  getPrivacyPolicy(): PrivacyPolicy<ContactPhoneNumber, ExampleViewerAlias> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): EditContactPhoneNumberActionTriggers {
    return [];
  }

  getObservers(): EditContactPhoneNumberActionObservers {
    return [];
  }

  getValidators(): EditContactPhoneNumberActionValidators {
    return [];
  }

  getInput(): ContactPhoneNumberEditInput {
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
      viewer: ExampleViewerAlias,
      contactPhoneNumber: ContactPhoneNumber,
      input: ContactPhoneNumberEditInput,
    ) => T,
    viewer: ExampleViewerAlias,
    contactPhoneNumber: ContactPhoneNumber,
    input: ContactPhoneNumberEditInput,
  ): T {
    return new this(viewer, contactPhoneNumber, input);
  }

  static async saveXFromID<T extends EditContactPhoneNumberActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      contactPhoneNumber: ContactPhoneNumber,
      input: ContactPhoneNumberEditInput,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
    input: ContactPhoneNumberEditInput,
  ): Promise<ContactPhoneNumber> {
    const contactPhoneNumber = await ContactPhoneNumber.loadX(viewer, id);
    return new this(viewer, contactPhoneNumber, input).saveX();
  }
}
