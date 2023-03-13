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
  loadEntX,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields } from "@snowtop/ent/schema";
import {
  GuestDataDBData,
  guestDataLoader,
  guestDataLoaderInfo,
} from "src/ent/generated/loaders";
import {
  GuestDataSource,
  NodeType,
  convertNullableGuestDataSource,
} from "src/ent/generated/types";
import { Event, Guest } from "src/ent/internal";
import schema from "src/schema/guest_data_schema";

export class GuestDataBase implements Ent<Viewer> {
  protected readonly data: GuestDataDBData;
  readonly nodeType = NodeType.GuestData;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly guestID: ID;
  readonly eventID: ID;
  readonly dietaryRestrictions: string;
  readonly source: GuestDataSource | null;

  constructor(public viewer: Viewer, data: Data) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.guestID = data.guest_id;
    this.eventID = data.event_id;
    this.dietaryRestrictions = data.dietary_restrictions;
    this.source = convertNullableGuestDataSource(data.source);
    // @ts-expect-error
    this.data = data;
  }

  __setRawDBData<GuestDataDBData>(data: GuestDataDBData) {}

  /** used by some ent internals to get access to raw db data. should not be depended on. may not always be on the ent **/
  ___getRawDBData(): GuestDataDBData {
    return this.data;
  }

  getPrivacyPolicy(): PrivacyPolicy<this, Viewer> {
    return AllowIfViewerPrivacyPolicy;
  }

  static async load<T extends GuestDataBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      GuestDataBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends GuestDataBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      GuestDataBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends GuestDataBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      GuestDataBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends GuestDataBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    viewer: Viewer,
    query: CustomQuery<GuestDataDBData>,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      {
        ...GuestDataBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
    )) as T[];
  }

  static async loadCustomData<T extends GuestDataBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    query: CustomQuery<GuestDataDBData>,
    context?: Context,
  ): Promise<GuestDataDBData[]> {
    return loadCustomData<GuestDataDBData, GuestDataDBData>(
      {
        ...GuestDataBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
      context,
    );
  }

  static async loadCustomCount<T extends GuestDataBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    query: CustomQuery<GuestDataDBData>,
    context?: Context,
  ): Promise<number> {
    return loadCustomCount(
      {
        ...GuestDataBase.loaderOptions.apply(this),
      },
      query,
      context,
    );
  }

  static async loadRawData<T extends GuestDataBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<GuestDataDBData | null> {
    const row = await guestDataLoader.createLoader(context).load(id);
    if (!row) {
      return null;
    }
    return row;
  }

  static async loadRawDataX<T extends GuestDataBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<GuestDataDBData> {
    const row = await guestDataLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends GuestDataBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
  ): LoadEntOptions<T, Viewer> {
    return {
      tableName: guestDataLoaderInfo.tableName,
      fields: guestDataLoaderInfo.fields,
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
