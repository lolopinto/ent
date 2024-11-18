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
import { FileDBData, fileLoader, fileLoaderInfo } from "./loaders";
import { NodeType } from "./types";
import { User } from "../internal";
import schema from "../../schema/file_schema";
import { ExampleViewer as ExampleViewerAlias } from "../../viewer/viewer";

export class FileBase implements Ent<ExampleViewerAlias> {
  protected readonly data: FileDBData;
  readonly nodeType = NodeType.File;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly path: string;
  readonly creatorId: ID;

  constructor(
    public viewer: ExampleViewerAlias,
    data: Data,
  ) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.name = data.name;
    this.path = data.path;
    this.creatorId = data.creator_id;
    // @ts-expect-error
    this.data = data;
  }

  __setRawDBData<FileDBData>(data: FileDBData) {}

  /** used by some ent internals to get access to raw db data. should not be depended on. may not always be on the ent **/
  ___getRawDBData(): FileDBData {
    return this.data;
  }

  getPrivacyPolicy(): PrivacyPolicy<this, ExampleViewerAlias> {
    return AllowIfViewerPrivacyPolicy;
  }

  static async load<T extends FileBase>(
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
      FileBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends FileBase>(
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
      FileBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends FileBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      FileBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends FileBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    viewer: ExampleViewerAlias,
    query: CustomQuery<FileDBData>,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      {
        ...FileBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
    )) as T[];
  }

  static async loadCustomData<T extends FileBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    query: CustomQuery<FileDBData>,
    context?: Context,
  ): Promise<FileDBData[]> {
    return loadCustomData<FileDBData, FileDBData>(
      {
        ...FileBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
      context,
    );
  }

  static async loadCustomCount<T extends FileBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    query: CustomQuery<FileDBData>,
    context?: Context,
  ): Promise<number> {
    return loadCustomCount(
      {
        ...FileBase.loaderOptions.apply(this),
      },
      query,
      context,
    );
  }

  static async loadRawData<T extends FileBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<FileDBData | null> {
    return fileLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends FileBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<FileDBData> {
    const row = await fileLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends FileBase>(
    this: new (
      viewer: ExampleViewerAlias,
      data: Data,
    ) => T,
  ): LoadEntOptions<T, ExampleViewerAlias, FileDBData> {
    return {
      tableName: fileLoaderInfo.tableName,
      fields: fileLoaderInfo.fields,
      ent: this,
      loaderFactory: fileLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (FileBase.schemaFields != null) {
      return FileBase.schemaFields;
    }
    return (FileBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return FileBase.getSchemaFields().get(key);
  }

  async loadCreator(): Promise<User | null> {
    return loadEnt(this.viewer, this.creatorId, User.loaderOptions());
  }

  loadCreatorX(): Promise<User> {
    return loadEntX(this.viewer, this.creatorId, User.loaderOptions());
  }
}
