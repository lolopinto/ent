// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerPrivacyPolicy,
  Context,
  CustomQuery,
  Data,
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
import { guestLoader, guestLoaderInfo } from "src/ent/generated/loaders";
import {
  Event,
  GuestGroup,
  GuestToAttendingEventsQuery,
  GuestToAuthCodesQuery,
  GuestToDeclinedEventsQuery,
  GuestToGuestDataQuery,
  NodeType,
} from "src/ent/internal";
import schema from "src/schema/guest";

interface GuestDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  name: string;
  event_id: ID;
  email_address: string | null;
  guest_group_id: ID;
  title: string | null;
}

export class GuestBase {
  readonly nodeType = NodeType.Guest;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly eventID: ID;
  readonly emailAddress: string | null;
  readonly guestGroupID: ID;
  readonly title: string | null;

  constructor(public viewer: Viewer, protected data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.name = data.name;
    this.eventID = data.event_id;
    this.emailAddress = data.email_address;
    this.guestGroupID = data.guest_group_id;
    this.title = data.title;
  }

  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends GuestBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      GuestBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends GuestBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      GuestBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends GuestBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      GuestBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends GuestBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      GuestBase.loaderOptions.apply(this),
      query,
    )) as T[];
  }

  static async loadCustomData<T extends GuestBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<GuestDBData[]> {
    return (await loadCustomData(
      GuestBase.loaderOptions.apply(this),
      query,
      context,
    )) as GuestDBData[];
  }

  static async loadRawData<T extends GuestBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<GuestDBData | null> {
    const row = await guestLoader.createLoader(context).load(id);
    if (!row) {
      return null;
    }
    return row as GuestDBData;
  }

  static async loadRawDataX<T extends GuestBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<GuestDBData> {
    const row = await guestLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row as GuestDBData;
  }

  static loaderOptions<T extends GuestBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: guestLoaderInfo.tableName,
      fields: guestLoaderInfo.fields,
      ent: this,
      loaderFactory: guestLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (GuestBase.schemaFields != null) {
      return GuestBase.schemaFields;
    }
    return (GuestBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return GuestBase.getSchemaFields().get(key);
  }

  queryGuestToAttendingEvents(): GuestToAttendingEventsQuery {
    return GuestToAttendingEventsQuery.query(this.viewer, this.id);
  }

  queryGuestToDeclinedEvents(): GuestToDeclinedEventsQuery {
    return GuestToDeclinedEventsQuery.query(this.viewer, this.id);
  }

  queryAuthCodes(): GuestToAuthCodesQuery {
    return GuestToAuthCodesQuery.query(this.viewer, this.id);
  }

  queryGuestData(): GuestToGuestDataQuery {
    return GuestToGuestDataQuery.query(this.viewer, this.id);
  }

  async loadEvent(): Promise<Event | null> {
    return loadEnt(this.viewer, this.eventID, Event.loaderOptions());
  }

  loadEventX(): Promise<Event> {
    return loadEntX(this.viewer, this.eventID, Event.loaderOptions());
  }

  async loadGuestGroup(): Promise<GuestGroup | null> {
    return loadEnt(this.viewer, this.guestGroupID, GuestGroup.loaderOptions());
  }

  loadGuestGroupX(): Promise<GuestGroup> {
    return loadEntX(this.viewer, this.guestGroupID, GuestGroup.loaderOptions());
  }
}
