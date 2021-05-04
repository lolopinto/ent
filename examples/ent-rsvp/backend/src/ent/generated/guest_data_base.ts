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
} from "@lolopinto/ent";
import { Field, getFields } from "@lolopinto/ent/schema";
import { NodeType, Event, Guest } from "src/ent/internal";
import schema from "src/schema/guest_data";

const tableName = "guest_data";
const fields = [
  "id",
  "created_at",
  "updated_at",
  "guest_id",
  "event_id",
  "dietary_restrictions",
];

export class GuestDataBase {
  readonly nodeType = NodeType.GuestData;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly guestID: ID;
  readonly eventID: ID;
  readonly dietaryRestrictions: string;

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = id;
    // TODO don't double read id
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.guestID = data.guest_id;
    this.eventID = data.event_id;
    this.dietaryRestrictions = data.dietary_restrictions;
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses
  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };

  static async load<T extends GuestDataBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, GuestDataBase.loaderOptions.apply(this));
  }

  static async loadX<T extends GuestDataBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, GuestDataBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends GuestDataBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, GuestDataBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends GuestDataBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await guestDataLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends GuestDataBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await guestDataLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends GuestDataBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: fields,
      ent: this,
      loaderFactory: guestDataLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (GuestDataBase.schemaFields != null) {
      return GuestDataBase.schemaFields;
    }
    return (GuestDataBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return GuestDataBase.getSchemaFields().get(key);
  }

  async loadEvent(): Promise<Event | null> {
    return loadEnt(this.viewer, this.eventID, Event.loaderOptions());
  }

  loadEventX(): Promise<Event> {
    return loadEntX(this.viewer, this.eventID, Event.loaderOptions());
  }

  async loadGuest(): Promise<Guest | null> {
    return loadEnt(this.viewer, this.guestID, Guest.loaderOptions());
  }

  loadGuestX(): Promise<Guest> {
    return loadEntX(this.viewer, this.guestID, Guest.loaderOptions());
  }
}

export const guestDataLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  pkey: "id",
});
