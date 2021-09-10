// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerPrivacyPolicy,
  Context,
  CustomQuery,
  Data,
  ID,
  LoadEntOptions,
  ObjectLoaderFactory,
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
import { NodeType, User } from "../internal";
import schema from "../../schema/contact";

const tableName = "contacts";
const fields = [
  "id",
  "created_at",
  "updated_at",
  "email_address",
  "first_name",
  "last_name",
  "user_id",
];

export class ContactBase {
  readonly nodeType = NodeType.Contact;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly emailAddress: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly userID: ID;

  constructor(public viewer: Viewer, data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.emailAddress = data.email_address;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.userID = data.user_id;
  }

  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends ContactBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, ContactBase.loaderOptions.apply(this));
  }

  static async loadX<T extends ContactBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, ContactBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends ContactBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, ContactBase.loaderOptions.apply(this), ...ids);
  }

  static async loadCustom<T extends ContactBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return loadCustomEnts(viewer, ContactBase.loaderOptions.apply(this), query);
  }

  static async loadCustomData<T extends ContactBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<Data[]> {
    return loadCustomData(
      ContactBase.loaderOptions.apply(this),
      query,
      context,
    );
  }

  static async loadRawData<T extends ContactBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await contactLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends ContactBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await contactLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends ContactBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: fields,
      ent: this,
      loaderFactory: contactLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (ContactBase.schemaFields != null) {
      return ContactBase.schemaFields;
    }
    return (ContactBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return ContactBase.getSchemaFields().get(key);
  }

  async loadUser(): Promise<User | null> {
    return loadEnt(this.viewer, this.userID, User.loaderOptions());
  }

  loadUserX(): Promise<User> {
    return loadEntX(this.viewer, this.userID, User.loaderOptions());
  }
}

export const contactLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "id",
});
