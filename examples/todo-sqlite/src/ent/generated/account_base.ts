// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerPrivacyPolicy,
  Context,
  Data,
  ID,
  LoadEntOptions,
  ObjectLoaderFactory,
  PrivacyPolicy,
  Viewer,
  loadEnt,
  loadEntViaKey,
  loadEntX,
  loadEntXViaKey,
  loadEnts,
} from "@lolopinto/ent";
import { Field, getFields } from "@lolopinto/ent/schema";
import { AccountToTodosQuery, NodeType } from "src/ent/internal";
import schema from "src/schema/account";

const tableName = "accounts";
const fields = ["id", "created_at", "updated_at", "name", "phone_number"];

export class AccountBase {
  readonly nodeType = NodeType.Account;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly phoneNumber: string;

  constructor(public viewer: Viewer, data: Data) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.name = data.name;
    this.phoneNumber = data.phone_number;
  }

  // default privacyPolicy is Viewer can see themselves
  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, AccountBase.loaderOptions.apply(this));
  }

  static async loadX<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, AccountBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, AccountBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await accountLoader.createLoader(context).load(id);
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
    return loadEntViaKey(viewer, phoneNumber, {
      ...AccountBase.loaderOptions.apply(this),
      loaderFactory: accountPhoneNumberLoader,
    });
  }

  static async loadFromPhoneNumberX<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    phoneNumber: string,
  ): Promise<T> {
    return loadEntXViaKey(viewer, phoneNumber, {
      ...AccountBase.loaderOptions.apply(this),
      loaderFactory: accountPhoneNumberLoader,
    });
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
    return await accountPhoneNumberLoader
      .createLoader(context)
      .load(phoneNumber);
  }

  static loaderOptions<T extends AccountBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: fields,
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

  queryTodos(): AccountToTodosQuery {
    return AccountToTodosQuery.query(this.viewer, this.id);
  }
}

export const accountLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "id",
});

export const accountPhoneNumberLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "phone_number",
});

accountLoader.addToPrime(accountPhoneNumberLoader);
accountPhoneNumberLoader.addToPrime(accountLoader);
