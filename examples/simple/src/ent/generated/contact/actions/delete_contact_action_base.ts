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
import { Action, Changeset, WriteOperation } from "@snowtop/ent/action";
import { Contact } from "../../..";
import { ContactBuilder, ContactInput } from "./contact_builder";

export class DeleteContactActionBase
  implements Action<Contact, ContactBuilder<ContactInput>, ContactInput>
{
  public readonly builder: ContactBuilder<ContactInput>;
  public readonly viewer: Viewer;
  protected contact: Contact;

  constructor(viewer: Viewer, contact: Contact) {
    this.viewer = viewer;
    this.builder = new ContactBuilder(
      this.viewer,
      WriteOperation.Delete,
      this,
      contact,
    );
    this.contact = contact;
  }

  getPrivacyPolicy(): PrivacyPolicy<Contact> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): ContactInput {
    return {};
  }

  async changeset(): Promise<Changeset<Contact>> {
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

  static create<T extends DeleteContactActionBase>(
    this: new (viewer: Viewer, contact: Contact) => T,
    viewer: Viewer,
    contact: Contact,
  ): T {
    return new this(viewer, contact);
  }

  static async saveXFromID<T extends DeleteContactActionBase>(
    this: new (viewer: Viewer, contact: Contact) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<void> {
    const contact = await Contact.loadX(viewer, id);
    return new this(viewer, contact).saveX();
  }
}