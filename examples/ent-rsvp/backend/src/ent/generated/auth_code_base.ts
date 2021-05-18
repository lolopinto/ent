// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  loadEnt,
  ID,
  Data,
  Viewer,
  loadEntX,
  loadEnts,
  LoadEntOptions,
  AlwaysDenyRule,
  AllowIfViewerRule,
  PrivacyPolicy,
  ObjectLoaderFactory,
  Context,
  loadEntViaKey,
  loadEntXViaKey,
} from "@lolopinto/ent";
import { Field, getFields } from "@lolopinto/ent/schema";
import { NodeType, Guest } from "src/ent/internal";
import schema from "src/schema/auth_code";

const tableName = "auth_codes";
const fields = [
  "id",
  "created_at",
  "updated_at",
  "code",
  "guest_id",
  "email_address",
  "sent_code",
];

export class AuthCodeBase {
  readonly nodeType = NodeType.AuthCode;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly code: string;
  readonly guestID: ID;
  readonly emailAddress: string;
  readonly sentCode: boolean;

  constructor(public viewer: Viewer, data: Data) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.code = data.code;
    this.guestID = data.guest_id;
    this.emailAddress = data.email_address;
    this.sentCode = data.sent_code;
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses
  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };

  static async load<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, AuthCodeBase.loaderOptions.apply(this));
  }

  static async loadX<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, AuthCodeBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, AuthCodeBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await authCodeLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await authCodeLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static async loadFromGuestID<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    guestID: ID,
  ): Promise<T | null> {
    return loadEntViaKey(viewer, guestID, {
      ...AuthCodeBase.loaderOptions.apply(this),
      loaderFactory: authCodeGuestIDLoader,
    });
  }

  static async loadFromGuestIDX<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    guestID: ID,
  ): Promise<T> {
    return loadEntXViaKey(viewer, guestID, {
      ...AuthCodeBase.loaderOptions.apply(this),
      loaderFactory: authCodeGuestIDLoader,
    });
  }

  static async loadIDFromGuestID<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    guestID: ID,
    context?: Context,
  ): Promise<ID | undefined> {
    const row = await authCodeGuestIDLoader.createLoader(context).load(guestID);
    return row?.id;
  }

  static async loadRawDataFromGuestID<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
    guestID: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await authCodeGuestIDLoader.createLoader(context).load(guestID);
  }

  static loaderOptions<T extends AuthCodeBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: fields,
      ent: this,
      loaderFactory: authCodeLoader,
    };
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

  async loadGuest(): Promise<Guest | null> {
    return loadEnt(this.viewer, this.guestID, Guest.loaderOptions());
  }

  loadGuestX(): Promise<Guest> {
    return loadEntX(this.viewer, this.guestID, Guest.loaderOptions());
  }
}

export const authCodeLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "id",
});

export const authCodeGuestIDLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "guest_id",
});

authCodeLoader.addToPrime(authCodeGuestIDLoader);
authCodeGuestIDLoader.addToPrime(authCodeLoader);
