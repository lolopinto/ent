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
  loadEntViaKey,
  loadEntX,
  loadEntXViaKey,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields } from "@snowtop/ent/schema";
import {
  UserStatisticsDBData,
  userStatisticsLoader,
  userStatisticsLoaderInfo,
  userStatisticsUserIdLoader,
} from "./loaders";
import { NodeType } from "./types";
import { User } from "../internal";
import schema from "../../schema/user_statistics_schema";
import { ExampleViewer as ExampleViewerAlias } from "../../viewer/viewer";

export class UserStatisticsBase implements Ent<ExampleViewerAlias> {
  protected readonly data: UserStatisticsDBData;
  readonly nodeType = NodeType.UserStatistics;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly userId: ID;
  readonly authCodeEmailsSent: number;

  constructor(
    public viewer: ExampleViewerAlias,
    data: Data,
  ) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.userId = data.user_id;
    this.authCodeEmailsSent = data.auth_code_emails_sent;
    // @ts-expect-error
    this.data = data;
  }

  __setRawDBData<UserStatisticsDBData>(data: UserStatisticsDBData) {}

  /** used by some ent internals to get access to raw db data. should not be depended on. may not always be on the ent **/
  ___getRawDBData(): UserStatisticsDBData {
    return this.data;
  }

  getPrivacyPolicy(): PrivacyPolicy<this, ExampleViewerAlias> {
    return AllowIfViewerPrivacyPolicy;
  }

  static async load<T extends UserStatisticsBase>(
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
      UserStatisticsBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends UserStatisticsBase>(
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
      UserStatisticsBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends UserStatisticsBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      UserStatisticsBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends UserStatisticsBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    query: CustomQuery<UserStatisticsDBData>,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      {
        ...UserStatisticsBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
    )) as T[];
  }

  static async loadCustomData<T extends UserStatisticsBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    query: CustomQuery<UserStatisticsDBData>,
    context?: Context,
  ): Promise<UserStatisticsDBData[]> {
    return loadCustomData<UserStatisticsDBData, UserStatisticsDBData>(
      {
        ...UserStatisticsBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
      context,
    );
  }

  static async loadCustomCount<T extends UserStatisticsBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    query: CustomQuery<UserStatisticsDBData>,
    context?: Context,
  ): Promise<number> {
    return loadCustomCount(
      {
        ...UserStatisticsBase.loaderOptions.apply(this),
      },
      query,
      context,
    );
  }

  static async loadRawData<T extends UserStatisticsBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<UserStatisticsDBData | null> {
    return userStatisticsLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends UserStatisticsBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<UserStatisticsDBData> {
    const row = await userStatisticsLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static async loadFromUserId<T extends UserStatisticsBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    userId: ID,
  ): Promise<T | null> {
    return (await loadEntViaKey(viewer, userId, {
      ...UserStatisticsBase.loaderOptions.apply(this),
      loaderFactory: userStatisticsUserIdLoader,
    })) as T | null;
  }

  static async loadFromUserIdX<T extends UserStatisticsBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    userId: ID,
  ): Promise<T> {
    return (await loadEntXViaKey(viewer, userId, {
      ...UserStatisticsBase.loaderOptions.apply(this),
      loaderFactory: userStatisticsUserIdLoader,
    })) as T;
  }

  static async loadIdFromUserId<T extends UserStatisticsBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    userId: ID,
    context?: Context,
  ): Promise<ID | undefined> {
    const row = await userStatisticsUserIdLoader
      .createLoader(context)
      .load(userId);
    return row?.id;
  }

  static async loadRawDataFromUserId<T extends UserStatisticsBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    userId: ID,
    context?: Context,
  ): Promise<UserStatisticsDBData | null> {
    return userStatisticsUserIdLoader.createLoader(context).load(userId);
  }

  static loaderOptions<T extends UserStatisticsBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
  ): LoadEntOptions<T, ExampleViewerAlias, UserStatisticsDBData> {
    return {
      tableName: userStatisticsLoaderInfo.tableName,
      fields: userStatisticsLoaderInfo.fields,
      ent: this,
      loaderFactory: userStatisticsLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (UserStatisticsBase.schemaFields != null) {
      return UserStatisticsBase.schemaFields;
    }
    return (UserStatisticsBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return UserStatisticsBase.getSchemaFields().get(key);
  }

  async loadUser(): Promise<User | null> {
    return loadEnt(this.viewer, this.userId, User.loaderOptions());
  }

  loadUserX(): Promise<User> {
    return loadEntX(this.viewer, this.userId, User.loaderOptions());
  }
}
