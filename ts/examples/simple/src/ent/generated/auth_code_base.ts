// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  loadEnt,
  ID,
  Data,
  Viewer,
  loadEntX,
  loadEnts,
  LoadEntOptions,
  loadRow,
  loadRowX,
  AlwaysDenyRule,
  PrivacyPolicy,
  query,
} from "@lolopinto/ent";
import { Field, getFields } from "@lolopinto/ent/schema";
import { NodeType, User } from "src/ent/internal";
import schema from "src/schema/auth_code";

const tableName = "auth_codes";

export class AuthCodeBase {
  readonly nodeType = NodeType.AuthCode;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly code: string;
  readonly userID: ID;
  readonly emailAddress: string;

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = id;
    // TODO don't double read id
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.code = data.code;
    this.userID = data.user_id;
    this.emailAddress = data.email_address;
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysDenyRule],
  };

  static async load<T extends AuthCodeBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, AuthCodeBase.loaderOptions.apply(this));
  }

  static async loadX<T extends AuthCodeBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, AuthCodeBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends AuthCodeBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, AuthCodeBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends AuthCodeBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data | null> {
    return await loadRow({
      ...AuthCodeBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static async loadRawDataX<T extends AuthCodeBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data> {
    return await loadRowX({
      ...AuthCodeBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static loaderOptions<T extends AuthCodeBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: AuthCodeBase.getFields(),
      ent: this,
    };
  }

  private static getFields(): string[] {
    return [
      "id",
      "created_at",
      "updated_at",
      "code",
      "user_id",
      "email_address",
    ];
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
