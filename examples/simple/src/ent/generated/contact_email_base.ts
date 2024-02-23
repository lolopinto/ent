/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerPrivacyPolicy,
  Context,
  CustomQuery,
  Data,
  Ent,
  ID,
  LoadEntOptions,
  PrivacyPolicy,
  loadCustomCount,
  loadCustomData,
  loadCustomEnts,
  loadEnt,
  loadEntX,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields } from "@snowtop/ent/schema";
import {
  ContactEmailDBData,
  contactEmailLoader,
  contactEmailLoaderInfo,
} from "./loaders";
import { ContactLabel, NodeType, convertContactLabel } from "./types";
import {
  Contact,
  ContactEmailToCommentsQuery,
  ContactEmailToLikersQuery,
  ContactInfoMixin,
  FeedbackMixin,
  IContactInfo,
  IFeedback,
} from "../internal";
import schema from "../../schema/contact_email_schema";
import { ExampleViewer as ExampleViewerAlias } from "../../viewer/viewer";

export class ContactEmailBase
  extends ContactInfoMixin(
    FeedbackMixin(class {} as new (...args: any[]) => IContactInfo & IFeedback),
  )
  implements Ent<ExampleViewerAlias>, IContactInfo, IFeedback
{
  protected readonly data: ContactEmailDBData;
  readonly nodeType = NodeType.ContactEmail;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly emailAddress: string;
  readonly label: ContactLabel;
  readonly contactId: ID;

  constructor(public viewer: ExampleViewerAlias, data: Data) {
    // @ts-ignore pass to mixin
    super(viewer, data);
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.emailAddress = data.email_address;
    this.label = convertContactLabel(data.label);
    this.contactId = data.contact_id;
    // @ts-expect-error
    this.data = data;
  }

  __setRawDBData<ContactEmailDBData>(data: ContactEmailDBData) {}

  /** used by some ent internals to get access to raw db data. should not be depended on. may not always be on the ent **/
  ___getRawDBData(): ContactEmailDBData {
    return this.data;
  }

  getPrivacyPolicy(): PrivacyPolicy<this, ExampleViewerAlias> {
    return AllowIfViewerPrivacyPolicy;
  }

  static async load<T extends ContactEmailBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      ContactEmailBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends ContactEmailBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      ContactEmailBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends ContactEmailBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      ContactEmailBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends ContactEmailBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    query: CustomQuery<ContactEmailDBData>,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      {
        ...ContactEmailBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
    )) as T[];
  }

  static async loadCustomData<T extends ContactEmailBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    query: CustomQuery<ContactEmailDBData>,
    context?: Context,
  ): Promise<ContactEmailDBData[]> {
    return loadCustomData<ContactEmailDBData, ContactEmailDBData>(
      {
        ...ContactEmailBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
      context,
    );
  }

  static async loadCustomCount<T extends ContactEmailBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    query: CustomQuery<ContactEmailDBData>,
    context?: Context,
  ): Promise<number> {
    return loadCustomCount(
      {
        ...ContactEmailBase.loaderOptions.apply(this),
      },
      query,
      context,
    );
  }

  static async loadRawData<T extends ContactEmailBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<ContactEmailDBData | null> {
    return contactEmailLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends ContactEmailBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<ContactEmailDBData> {
    const row = await contactEmailLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends ContactEmailBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
  ): LoadEntOptions<T, ExampleViewerAlias, ContactEmailDBData> {
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

  queryComments(): ContactEmailToCommentsQuery {
    return ContactEmailToCommentsQuery.query(this.viewer, this.id);
  }

  queryLikers(): ContactEmailToLikersQuery {
    return ContactEmailToLikersQuery.query(this.viewer, this.id);
  }

  async loadContact(): Promise<Contact | null> {
    return loadEnt(this.viewer, this.contactId, Contact.loaderOptions());
  }

  loadContactX(): Promise<Contact> {
    return loadEntX(this.viewer, this.contactId, Contact.loaderOptions());
  }
}
