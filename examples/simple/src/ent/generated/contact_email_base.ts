/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerPrivacyPolicy,
  Context,
  CustomQuery,
  Data,
  ID,
  LoadEntOptions,
  PrivacyPolicy,
  Viewer,
  convertDate,
  loadCustomData,
  loadCustomEnts,
  loadEnt,
  loadEntX,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields } from "@snowtop/ent/schema";
import { contactEmailLoader, contactEmailLoaderInfo } from "./loaders";
import { Contact, NodeType } from "../internal";
import schema from "../../schema/contact_email";

export class ContactEmailBase {
  readonly nodeType = NodeType.ContactEmail;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly emailAddress: string;
  readonly label: string;
  readonly contactID: ID;

  constructor(public viewer: Viewer, protected data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.emailAddress = data.email_address;
    this.label = data.label;
    this.contactID = data.contact_id;
  }

  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends ContactEmailBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      ContactEmailBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends ContactEmailBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      ContactEmailBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends ContactEmailBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return (await loadEnts(
      viewer,
      ContactEmailBase.loaderOptions.apply(this),
      ...ids,
    )) as T[];
  }

  static async loadCustom<T extends ContactEmailBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      ContactEmailBase.loaderOptions.apply(this),
      query,
    )) as T[];
  }

  static async loadCustomData<T extends ContactEmailBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<Data[]> {
    return loadCustomData(
      ContactEmailBase.loaderOptions.apply(this),
      query,
      context,
    );
  }

  static async loadRawData<T extends ContactEmailBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return contactEmailLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends ContactEmailBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await contactEmailLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends ContactEmailBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: contactEmailLoaderInfo.tableName,
      fields: contactEmailLoaderInfo.fields,
      ent: this,
      loaderFactory: contactEmailLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (ContactEmailBase.schemaFields != null) {
      return ContactEmailBase.schemaFields;
    }
    return (ContactEmailBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return ContactEmailBase.getSchemaFields().get(key);
  }

  loadContact(): Promise<Contact | null> {
    return loadEnt(this.viewer, this.contactID, Contact.loaderOptions());
  }

  loadContactX(): Promise<Contact> {
    return loadEntX(this.viewer, this.contactID, Contact.loaderOptions());
  }
}
