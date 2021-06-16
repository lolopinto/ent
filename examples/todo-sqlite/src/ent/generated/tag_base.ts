// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerPrivacyPolicy,
  AssocEdge,
  Context,
  Data,
  ID,
  LoadEntOptions,
  ObjectLoaderFactory,
  PrivacyPolicy,
  Viewer,
  loadEnt,
  loadEntX,
  loadEnts,
} from "@lolopinto/ent";
import { Field, getFields } from "@lolopinto/ent/schema";
import { Account, EdgeType, NodeType, TagToTodosQuery } from "src/ent/internal";
import schema from "src/schema/tag";

const tableName = "tags";
const fields = [
  "id",
  "created_at",
  "updated_at",
  "display_name",
  "canonical_name",
  "owner_id",
];

export class TagBase {
  readonly nodeType = NodeType.Tag;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly displayName: string;
  readonly canonicalName: string;
  readonly ownerID: ID;

  constructor(public viewer: Viewer, data: Data) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.displayName = data.display_name;
    this.canonicalName = data.canonical_name;
    this.ownerID = data.owner_id;
  }

  // default privacyPolicy is Viewer can see themselves
  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends TagBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, TagBase.loaderOptions.apply(this));
  }

  static async loadX<T extends TagBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, TagBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends TagBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, TagBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends TagBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await tagLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends TagBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await tagLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends TagBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: fields,
      ent: this,
      loaderFactory: tagLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (TagBase.schemaFields != null) {
      return TagBase.schemaFields;
    }
    return (TagBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return TagBase.getSchemaFields().get(key);
  }

  queryTodos(): TagToTodosQuery {
    return TagToTodosQuery.query(this.viewer, this.id);
  }

  async loadOwner(): Promise<Account | null> {
    return loadEnt(this.viewer, this.ownerID, Account.loaderOptions());
  }

  loadOwnerX(): Promise<Account> {
    return loadEntX(this.viewer, this.ownerID, Account.loaderOptions());
  }
}

export const tagLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "id",
});
