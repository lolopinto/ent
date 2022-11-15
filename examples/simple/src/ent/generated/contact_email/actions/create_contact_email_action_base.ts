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
import { ContactInfo } from "../../types";
import { ExampleViewer as ExampleViewerAlias } from "../../../../viewer/viewer";

export interface ContactEmailCreateInput {
  extra?: ContactInfo | null;
  emailAddress: string;
  label: string;
  contactID: ID | Builder<Contact, ExampleViewerAlias>;
}

export type CreateContactEmailActionTriggers = (
  | Trigger<
      ContactEmail,
      ContactEmailBuilder<ContactEmailCreateInput, ContactEmail | null>,
      ExampleViewerAlias,
      ContactEmailCreateInput,
      ContactEmail | null
    >
  | Trigger<
      ContactEmail,
      ContactEmailBuilder<ContactEmailCreateInput, ContactEmail | null>,
      ExampleViewerAlias,
      ContactEmailCreateInput,
      ContactEmail | null
    >[]
)[];

export type CreateContactEmailActionObservers = Observer<
  ContactEmail,
  ContactEmailBuilder<ContactEmailCreateInput, ContactEmail | null>,
  ExampleViewerAlias,
  ContactEmailCreateInput,
  ContactEmail | null
>[];

export type CreateContactEmailActionValidators = Validator<
  ContactEmail,
  ContactEmailBuilder<ContactEmailCreateInput, ContactEmail | null>,
  ExampleViewerAlias,
  ContactEmailCreateInput,
  ContactEmail | null
>[];

export class CreateContactEmailActionBase
  implements
    Action<
      ContactEmail,
      ContactEmailBuilder<ContactEmailCreateInput, ContactEmail | null>,
      ExampleViewerAlias,
      ContactEmailCreateInput,
      ContactEmail | null
    >
{
  public readonly builder: ContactEmailBuilder<
    ContactEmailCreateInput,
    ContactEmail | null
  >;
  public readonly viewer: ExampleViewerAlias;
  protected input: ContactEmailCreateInput;

  constructor(viewer: ExampleViewerAlias, input: ContactEmailCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new ContactEmailBuilder(
      this.viewer,
      WriteOperation.Insert,
      this,
      null,
    );
  }

  getPrivacyPolicy(): PrivacyPolicy<ContactEmail, ExampleViewerAlias> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): CreateContactEmailActionTriggers {
    return [];
  }

  getObservers(): CreateContactEmailActionObservers {
    return [];
  }

  getValidators(): CreateContactEmailActionValidators {
    return [];
  }

  getInput(): ContactEmailCreateInput {
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

  static create<T extends CreateContactEmailActionBase>(
    this: new (
      viewer: ExampleViewerAlias,
      input: ContactEmailCreateInput,
    ) => T,
    viewer: ExampleViewerAlias,
    input: ContactEmailCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
