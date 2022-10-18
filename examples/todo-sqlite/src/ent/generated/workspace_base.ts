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
  convertDate,
  convertNullableDate,
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
  workspaceLoader,
  workspaceLoaderInfo,
  workspaceNoTransformLoader,
  workspaceSlugLoader,
} from "src/ent/generated/loaders";
import { Account, NodeType, WorkspaceToMembersQuery } from "src/ent/internal";
import schema from "src/schema/workspace_schema";

interface WorkspaceDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  name: string;
  creator_id: ID;
  slug: string;
}

export class WorkspaceBase implements Ent<Viewer> {
  readonly nodeType = NodeType.Workspace;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  protected readonly deletedAt: Date | null;
  readonly name: string;
  readonly creatorID: ID;
  readonly slug: string;

  constructor(public viewer: Viewer, protected data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.deletedAt = convertNullableDate(data.deleted_at);
    this.name = data.name;
    this.creatorID = data.creator_id;
    this.slug = data.slug;
  }

  getPrivacyPolicy(): PrivacyPolicy<this, Viewer> {
    return AllowIfViewerPrivacyPolicy;
  }

  static async load<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      WorkspaceBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      WorkspaceBase.loaderOptions.apply(this),
    )) as T;
  }

  // loadNoTransform and loadNoTransformX exist to load the data from the db
  // with no transformations which are currently done implicitly
  // we don't generate the full complement of read-APIs
  // but can easily query the raw data with workspaceNoTransformLoader
  static async loadNoTransform<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    const opts = {
      ...WorkspaceBase.loaderOptions.apply(this),
      loaderFactory: workspaceNoTransformLoader,
    };

    return (await loadEnt(viewer, id, opts)) as T | null;
  }

  static async loadNoTransformX<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    const opts = {
      ...WorkspaceBase.loaderOptions.apply(this),
      loaderFactory: workspaceNoTransformLoader,
    };
    return (await loadEntX(viewer, id, opts)) as T;
  }

  static async loadMany<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      WorkspaceBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      {
        ...WorkspaceBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
    )) as T[];
  }

  static async loadCustomData<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<WorkspaceDBData[]> {
    return (await loadCustomData(
      {
        ...WorkspaceBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
      context,
    )) as WorkspaceDBData[];
  }

  static async loadCustomCount<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<number> {
    return loadCustomCount(
      {
        ...WorkspaceBase.loaderOptions.apply(this),
      },
      query,
      context,
    );
  }

  static async loadRawData<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<WorkspaceDBData | null> {
    const row = await workspaceLoader.createLoader(context).load(id);
    if (!row) {
      return null;
    }
    return row as WorkspaceDBData;
  }

  static async loadRawDataX<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<WorkspaceDBData> {
    const row = await workspaceLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row as WorkspaceDBData;
  }

  static async loadFromSlug<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    slug: string,
  ): Promise<T | null> {
    return (await loadEntViaKey(viewer, slug, {
      ...WorkspaceBase.loaderOptions.apply(this),
      loaderFactory: workspaceSlugLoader,
    })) as T | null;
  }

  static async loadFromSlugX<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    slug: string,
  ): Promise<T> {
    return (await loadEntXViaKey(viewer, slug, {
      ...WorkspaceBase.loaderOptions.apply(this),
      loaderFactory: workspaceSlugLoader,
    })) as T;
  }

  static async loadIDFromSlug<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    slug: string,
    context?: Context,
  ): Promise<ID | undefined> {
    const row = await workspaceSlugLoader.createLoader(context).load(slug);
    return row?.id;
  }

  static async loadRawDataFromSlug<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
    slug: string,
    context?: Context,
  ): Promise<WorkspaceDBData | null> {
    const row = await workspaceSlugLoader.createLoader(context).load(slug);
    if (!row) {
      return null;
    }
    return row as WorkspaceDBData;
  }

  static loaderOptions<T extends WorkspaceBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T, Viewer> {
    return {
      tableName: workspaceLoaderInfo.tableName,
      fields: workspaceLoaderInfo.fields,
      ent: this,
      loaderFactory: workspaceLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (WorkspaceBase.schemaFields != null) {
      return WorkspaceBase.schemaFields;
    }
    return (WorkspaceBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return WorkspaceBase.getSchemaFields().get(key);
  }

  queryMembers(): WorkspaceToMembersQuery {
    return WorkspaceToMembersQuery.query(this.viewer, this.id);
  }

  async loadCreator(): Promise<Account | null> {
    return loadEnt(this.viewer, this.creatorID, Account.loaderOptions());
  }

  loadCreatorX(): Promise<Account> {
    return loadEntX(this.viewer, this.creatorID, Account.loaderOptions());
  }
}
