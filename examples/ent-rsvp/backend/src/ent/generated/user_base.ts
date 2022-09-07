// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerPrivacyPolicy,
  Context,
  CustomQuery,
  Data,
  Ent,
  ID,
  LoadEntOptions,
  PrivacyPolicy,
  Viewer,
  loadCustomCount,
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
  userEmailAddressLoader,
  userLoader,
  userLoaderInfo,
} from "src/ent/generated/loaders";
import { NodeType, UserToEventsQuery } from "src/ent/internal";
import schema from "src/schema/user_schema";

interface UserDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  first_name: string;
  last_name: string;
  email_address: string;
  password: string;
}

export class UserBase implements Ent<Viewer> {
  readonly nodeType = NodeType.User;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly firstName: string;
  readonly lastName: string;
  readonly emailAddress: string;
  protected readonly password: string;

  constructor(public viewer: Viewer, protected data: Data) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.emailAddress = data.email_address;
    this.password = data.password;
  }

  getPrivacyPolicy(): PrivacyPolicy<this, Viewer> {
    return AllowIfViewerPrivacyPolicy;
  }

  static async load<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      UserBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      UserBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      UserBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      {
        ...UserBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
    )) as T[];
  }

  static async loadCustomData<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<UserDBData[]> {
    return (await loadCustomData(
      {
        ...UserBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
      context,
    )) as UserDBData[];
  }

  static async loadCustomCount<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<number> {
    return loadCustomCount(
      {
        ...UserBase.loaderOptions.apply(this),
      },
      query,
      context,
    );
  }

  static async loadRawData<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<UserDBData | null> {
    const row = await userLoader.createLoader(context).load(id);
    if (!row) {
      return null;
    }
    return row as UserDBData;
  }

  static async loadRawDataX<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<UserDBData> {
    const row = await userLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row as UserDBData;
  }

  static async loadFromEmailAddress<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    emailAddress: string,
  ): Promise<T | null> {
    return (await loadEntViaKey(viewer, emailAddress, {
      ...UserBase.loaderOptions.apply(this),
      loaderFactory: userEmailAddressLoader,
    })) as T | null;
  }

  static async loadFromEmailAddressX<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    emailAddress: string,
  ): Promise<T> {
    return (await loadEntXViaKey(viewer, emailAddress, {
      ...UserBase.loaderOptions.apply(this),
      loaderFactory: userEmailAddressLoader,
    })) as T;
  }

  static async loadIDFromEmailAddress<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    emailAddress: string,
    context?: Context,
  ): Promise<ID | undefined> {
    const row = await userEmailAddressLoader
      .createLoader(context)
      .load(emailAddress);
    return row?.id;
  }

  static async loadRawDataFromEmailAddress<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
    emailAddress: string,
    context?: Context,
  ): Promise<UserDBData | null> {
    const row = await userEmailAddressLoader
      .createLoader(context)
      .load(emailAddress);
    if (!row) {
      return null;
    }
    return row as UserDBData;
  }

  static loaderOptions<T extends UserBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T, Viewer> {
    return {
      tableName: userLoaderInfo.tableName,
      fields: userLoaderInfo.fields,
      ent: this,
      loaderFactory: userLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (UserBase.schemaFields != null) {
      return UserBase.schemaFields;
    }
    return (UserBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return UserBase.getSchemaFields().get(key);
  }

  queryEvents(): UserToEventsQuery {
    return UserToEventsQuery.query(this.viewer, this.id);
  }
}
