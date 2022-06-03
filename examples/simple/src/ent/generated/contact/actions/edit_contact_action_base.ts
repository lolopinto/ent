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
import { Contact, User } from "../../..";
import { ContactBuilder } from "./contact_builder";
import { ExampleViewer } from "../../../../viewer/viewer";

export interface ContactEditInput {
  emailIds?: ID[];
  phoneNumberIds?: ID[];
  firstName?: string;
  lastName?: string;
  userID?: ID | Builder<User, ExampleViewer>;
}

export class EditContactActionBase
  implements
    Action<
      Contact,
      ContactBuilder<ContactEditInput, Contact>,
      ExampleViewer,
      ContactEditInput,
      Contact
    >
{
  public readonly builder: ContactBuilder<ContactEditInput, Contact>;
  public readonly viewer: ExampleViewer;
  protected input: ContactEditInput;
  protected contact: Contact;

  constructor(
    viewer: ExampleViewer,
    contact: Contact,
    input: ContactEditInput,
  ) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new ContactBuilder(
      this.viewer,
      WriteOperation.Edit,
      this,
      contact,
    );
    this.contact = contact;
  }

  getPrivacyPolicy(): PrivacyPolicy<Contact> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): Trigger<
    Contact,
    ContactBuilder<ContactEditInput, Contact>,
    ExampleViewer,
    ContactEditInput,
    Contact
  >[] {
    return [];
  }

  getObservers(): Observer<
    Contact,
    ContactBuilder<ContactEditInput, Contact>,
    ExampleViewer,
    ContactEditInput,
    Contact
  >[] {
    return [];
  }

  getValidators(): Validator<
    Contact,
    ContactBuilder<ContactEditInput, Contact>,
    ExampleViewer,
    ContactEditInput,
    Contact
  >[] {
    return [];
  }

  getInput(): ContactEditInput {
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

  async save(): Promise<Contact | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Contact> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends EditContactActionBase>(
    this: new (
      viewer: ExampleViewer,
      contact: Contact,
      input: ContactEditInput,
    ) => T,
    viewer: ExampleViewer,
    contact: Contact,
    input: ContactEditInput,
  ): T {
    return new this(viewer, contact, input);
  }

  static async saveXFromID<T extends EditContactActionBase>(
    this: new (
      viewer: ExampleViewer,
      contact: Contact,
      input: ContactEditInput,
    ) => T,
    viewer: ExampleViewer,
    id: ID,
    input: ContactEditInput,
  ): Promise<Contact> {
    const contact = await Contact.loadX(viewer, id);
    return new this(viewer, contact, input).saveX();
  }
}
