/**
 * Copyright whaa whaa
 * Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.
 */

import {
  AllowIfViewerPrivacyPolicy,
  AssocEdge,
  Context,
  CustomQuery,
  Data,
  Ent,
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
import { CommentToPostQuery, EdgeType, NodeType } from "../internal";
import { loadEntByType, loadEntXByType } from "../loadAny";
import schema from "../../schema/comment";

const tableName = "comments";
const fields = [
  "id",
  "created_at",
  "updated_at",
  "author_id",
  "body",
  "article_id",
  "article_type",
];

export class CommentBase {
  readonly nodeType = NodeType.Comment;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly authorID: ID;
  readonly body: string;
  readonly articleID: ID;
  readonly articleType: string;

  constructor(public viewer: Viewer, data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.authorID = data.author_id;
    this.body = data.body;
    this.articleID = data.article_id;
    this.articleType = data.article_type;
  }

  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, CommentBase.loaderOptions.apply(this));
  }

  static async loadX<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, CommentBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, CommentBase.loaderOptions.apply(this), ...ids);
  }

  static async loadCustom<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return loadCustomEnts(viewer, CommentBase.loaderOptions.apply(this), query);
  }

  static async loadCustomData<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<Data[]> {
    return loadCustomData(
      CommentBase.loaderOptions.apply(this),
      query,
      context,
    );
  }

  static async loadRawData<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await commentLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await commentLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: fields,
      ent: this,
      loaderFactory: commentLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (CommentBase.schemaFields != null) {
      return CommentBase.schemaFields;
    }
    return (CommentBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return CommentBase.getSchemaFields().get(key);
  }

  queryPost(): CommentToPostQuery {
    return CommentToPostQuery.query(this.viewer, this.id);
  }

  async loadArticle(): Promise<Ent | null> {
    return loadEntByType(
      this.viewer,
      this.articleType as unknown as NodeType,
      this.articleID,
    );
  }

  loadArticleX(): Promise<Ent> {
    return loadEntXByType(
      this.viewer,
      this.articleType as unknown as NodeType,
      this.articleID,
    );
  }
}

export const commentLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "id",
});
