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
import { Contact, User } from "../../..";
import { ContactBuilder } from "./contact_builder";

export interface ContactCreateInput {
  emailAddress: string;
  firstName: string;
  lastName: string;
  userID: ID | Builder<User>;
}

export class CreateContactActionBase
  implements
    Action<Contact, ContactBuilder<ContactCreateInput>, ContactCreateInput>
{
  public readonly builder: ContactBuilder<ContactCreateInput>;
  public readonly viewer: Viewer;
  protected input: ContactCreateInput;

  constructor(viewer: Viewer, input: ContactCreateInput) {
    this.viewer = viewer;
    this.input = input;
    this.builder = new ContactBuilder(this.viewer, WriteOperation.Insert, this);
  }

  getPrivacyPolicy(): PrivacyPolicy<Contact> {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getInput(): ContactCreateInput {
    return this.input;
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

  async save(): Promise<Contact | null> {
    await this.builder.save();
    return this.builder.editedEnt();
  }

  async saveX(): Promise<Contact> {
    await this.builder.saveX();
    return this.builder.editedEntX();
  }

  static create<T extends CreateContactActionBase>(
    this: new (viewer: Viewer, input: ContactCreateInput) => T,
    viewer: Viewer,
    input: ContactCreateInput,
  ): T {
    return new this(viewer, input);
  }
}
