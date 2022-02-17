// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

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
  loadEntViaKey,
  loadEntX,
  loadEntXViaKey,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields } from "@snowtop/ent/schema";
import {
  accountLoader,
  accountLoaderInfo,
  accountPhoneNumberLoader,
} from "src/ent/generated/loaders";
import {
  AccountToTagsQuery,
  AccountToTodosQuery,
  NodeType,
} from "src/ent/internal";
import schema from "src/schema/account";

export class AccountBase {
  readonly nodeType = NodeType.Account;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly phoneNumber: string;

  constructor(public viewer: Viewer, protected data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.name = data.name;
    this.phoneNumber = data.phone_number;
  }

  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      AccountBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      AccountBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return (await loadEnts(
      viewer,
      AccountBase.loaderOptions.apply(this),
      ...ids,
    )) as T[];
  }

  static async loadCustom<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      AccountBase.loaderOptions.apply(this),
      query,
    )) as T[];
  }

  static async loadCustomData<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<Data[]> {
    return loadCustomData(
      AccountBase.loaderOptions.apply(this),
      query,
      context,
    );
  }

  static async loadRawData<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return accountLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await accountLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static async loadFromPhoneNumber<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    phoneNumber: string,
  ): Promise<T | null> {
    return (await loadEntViaKey(viewer, phoneNumber, {
      ...AccountBase.loaderOptions.apply(this),
      loaderFactory: accountPhoneNumberLoader,
    })) as T | null;
  }

  static async loadFromPhoneNumberX<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    phoneNumber: string,
  ): Promise<T> {
    return (await loadEntXViaKey(viewer, phoneNumber, {
      ...AccountBase.loaderOptions.apply(this),
      loaderFactory: accountPhoneNumberLoader,
    })) as T;
  }

  static async loadIDFromPhoneNumber<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    phoneNumber: string,
    context?: Context,
  ): Promise<ID | undefined> {
    const row = await accountPhoneNumberLoader
      .createLoader(context)
      .load(phoneNumber);
    return row?.id;
  }

  static async loadRawDataFromPhoneNumber<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    phoneNumber: string,
    context?: Context,
  ): Promise<Data | null> {
    return accountPhoneNumberLoader.createLoader(context).load(phoneNumber);
  }

  static loaderOptions<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: accountLoaderInfo.tableName,
      fields: accountLoaderInfo.fields,
      ent: this,
      loaderFactory: accountLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (AccountBase.schemaFields != null) {
      return AccountBase.schemaFields;
    }
    return (AccountBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return AccountBase.getSchemaFields().get(key);
  }

  queryTags(): AccountToTagsQuery {
    return AccountToTagsQuery.query(this.viewer, this.id);
  }

  queryTodos(): AccountToTodosQuery {
    return AccountToTodosQuery.query(this.viewer, this.id);
  }
}
