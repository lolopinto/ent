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
  Viewer,
  convertDate,
  loadCustomData,
  loadCustomEnts,
  loadEnt,
  loadEntX,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields } from "@snowtop/ent/schema";
import { loadEntByType, loadEntXByType } from "./loadAny";
import { commentLoader, commentLoaderInfo } from "./loaders";
import {
  ArticleToCommentsQuery,
  CommentToPostQuery,
  NodeType,
  User,
} from "../internal";
import schema from "../../schema/comment";

export interface CommentData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  author_id: ID;
  body: string;
  article_id: ID;
  article_type: string;
}

export class CommentBase {
  readonly nodeType = NodeType.Comment;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly authorID: ID;
  readonly body: string;
  readonly articleID: ID;
  readonly articleType: string;

  constructor(public viewer: Viewer, protected data: Data) {
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
    return (await loadEnt(
      viewer,
      id,
      CommentBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      CommentBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      CommentBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      CommentBase.loaderOptions.apply(this),
      query,
    )) as T[];
  }

  static async loadCustomData<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<CommentData[]> {
    return (await loadCustomData(
      CommentBase.loaderOptions.apply(this),
      query,
      context,
    )) as CommentData[];
  }

  static async loadRawData<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<CommentData | null> {
    const row = await commentLoader.createLoader(context).load(id);
    if (!row) {
      return null;
    }
    return row as CommentData;
  }

  static async loadRawDataX<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<CommentData> {
    const row = await commentLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row as CommentData;
  }

  static queryFromArticle<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ent: Ent,
  ): ArticleToCommentsQuery {
    return ArticleToCommentsQuery.query(viewer, ent);
  }

  static loaderOptions<T extends CommentBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: commentLoaderInfo.tableName,
      fields: commentLoaderInfo.fields,
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

  async loadAuthor(): Promise<User | null> {
    return loadEnt(this.viewer, this.authorID, User.loaderOptions());
  }

  loadAuthorX(): Promise<User> {
    return loadEntX(this.viewer, this.authorID, User.loaderOptions());
  }
}
