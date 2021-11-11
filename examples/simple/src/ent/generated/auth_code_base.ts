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
import schema from "../../schema/auth_code";

const tableName = "auth_codes";
const fields = [
  "id",
  "created_at",
  "updated_at",
  "code",
  "user_id",
  "email_address",
  "phone_number",
];

export class AuthCodeBase {
  readonly nodeType = NodeType.AuthCode;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly code: string;
  readonly userID: ID;
  readonly emailAddress: string | null;
  readonly phoneNumber: string | null;

  constructor(public viewer: Viewer, protected data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.code = data.code;
    this.userID = data.user_id;
    this.emailAddress = data.email_address;
    this.phoneNumber = data.phone_number;
  }

  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      AuthCodeBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      AuthCodeBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      AuthCodeBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      AuthCodeBase.loaderOptions.apply(this),
      query,
    )) as T[];
  }

  static async loadCustomData<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<Data[]> {
    return loadCustomData(
      AuthCodeBase.loaderOptions.apply(this),
      query,
      context,
    );
  }

  static async loadRawData<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return authCodeLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await authCodeLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName,
      fields,
      ent: this,
      loaderFactory: authCodeLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (AuthCodeBase.schemaFields != null) {
      return AuthCodeBase.schemaFields;
    }
    return (AuthCodeBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return AuthCodeBase.getSchemaFields().get(key);
  }

  async loadUser(): Promise<User | null> {
    return loadEnt(this.viewer, this.userID, User.loaderOptions());
  }

  loadUserX(): Promise<User> {
    return loadEntX(this.viewer, this.userID, User.loaderOptions());
  }
}

export const authCodeLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "id",
});
