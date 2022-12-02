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
import { Contact, ContactEmail } from "../../..";
import { ContactEmailBuilder } from "./contact_email_builder";
import { ContactEmailLabel, ContactInfo } from "../../types";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface ContactEmailEditInput {
  extra?: ContactInfo | null;
  emailAddress?: string;
  label?: ContactEmailLabel;
  contactID?: ID | Builder<Contact, ExampleViewerAlias>;
}

export type EditContactEmailActionTriggers = (
  | Trigger<
      ContactEmail,
      ContactEmailBuilder<ContactEmailEditInput, ContactEmail>,
      ExampleViewerAlias,
      ContactEmailEditInput,
      ContactEmail
    >
  | Trigger<
      ContactEmail,
      ContactEmailBuilder<ContactEmailEditInput, ContactEmail>,
      ExampleViewerAlias,
      ContactEmailEditInput,
      ContactEmail
    >[]
)[];

export type EditContactEmailActionObservers = Observer<
  ContactEmail,
  ContactEmailBuilder<ContactEmailEditInput, ContactEmail>,
  ExampleViewerAlias,
  ContactEmailEditInput,
  ContactEmail
>[];

export type EditContactEmailActionValidators = Validator<
  ContactEmail,
  ContactEmailBuilder<ContactEmailEditInput, ContactEmail>,
  ExampleViewerAlias,
  ContactEmailEditInput,
  ContactEmail
>[];

export class EditContactEmailActionBase
  implements
    Action<
      ContactEmail,
      ContactEmailBuilder<ContactEmailEditInput, ContactEmail>,
      ExampleViewerAlias,
      ContactEmailEditInput,
      ContactEmail
    >
{
  public readonly builder: ContactEmailBuilder<
    ContactEmailEditInput,
    ContactEmail
  >;
  public readonly viewer: ExampleViewerAlias;
  protected input: ContactEmailEditInput;
  protected readonly contactEmail: ContactEmail;

  constructor(
    viewer: ExampleViewerAlias,
    contactEmail: ContactEmail,
    input: ContactEmailEditInput,
  ) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new ContactEmailBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      contactEmail,
    );
    this.contactEmail = contactEmail;
  }

  getPrivacyPolicy(): PrivacyPolicy<ContactEmail, ExampleViewerAlias> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): EditContactEmailActionTriggers {
    return [];
  }

  getObservers(): EditContactEmailActionObservers {
    return [];
  }

  getValidators(): EditContactEmailActionValidators {
    return [];
  }

  getInput(): ContactEmailEditInput {
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

  async save(): Promise<ContactEmail | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<ContactEmail> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends EditContactEmailActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      contactEmail: ContactEmail,
      input: ContactEmailEditInput,
    ) => T,
    viewer: ExampleViewerAlias,
    contactEmail: ContactEmail,
    input: ContactEmailEditInput,
  ): T {
    return new this(viewer, contactEmail, input);
  }

  static async saveXFromID<T extends EditContactEmailActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      contactEmail: ContactEmail,
      input: ContactEmailEditInput,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
    input: ContactEmailEditInput,
  ): Promise<ContactEmail> {
    const contactEmail = await ContactEmail.loadX(viewer, id);
    return new this(viewer, contactEmail, input).saveX();
  }
}
