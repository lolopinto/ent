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
  loadCustomData,
  loadCustomEnts,
  loadEnt,
  loadEntX,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields } from "@snowtop/ent/schema";
import {
  guestGroupLoader,
  guestGroupLoaderInfo,
} from "src/ent/generated/loaders";
import {
  Event,
  GuestGroupToGuestsQuery,
  GuestGroupToInvitedEventsQuery,
  NodeType,
} from "src/ent/internal";
import schema from "src/schema/guest_group_schema";

interface GuestGroupDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  invitation_name: string;
  event_id: ID;
}

export class GuestGroupBase implements Ent<Viewer> {
  readonly nodeType = NodeType.GuestGroup;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly invitationName: string;
  readonly eventID: ID;

  constructor(public viewer: Viewer, protected data: Data) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.invitationName = data.invitation_name;
    this.eventID = data.event_id;
  }

  getPrivacyPolicy(): PrivacyPolicy<this, Viewer> {
    return AllowIfViewerPrivacyPolicy;
  }

  static async load<T extends GuestGroupBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      GuestGroupBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends GuestGroupBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      GuestGroupBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends GuestGroupBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      GuestGroupBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends GuestGroupBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      {
        ...GuestGroupBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
    )) as T[];
  }

  static async loadCustomData<T extends GuestGroupBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<GuestGroupDBData[]> {
    return (await loadCustomData(
      {
        ...GuestGroupBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
      context,
    )) as GuestGroupDBData[];
  }

  static async loadRawData<T extends GuestGroupBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<GuestGroupDBData | null> {
    const row = await guestGroupLoader.createLoader(context).load(id);
    if (!row) {
      return null;
    }
    return row as GuestGroupDBData;
  }

  static async loadRawDataX<T extends GuestGroupBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<GuestGroupDBData> {
    const row = await guestGroupLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row as GuestGroupDBData;
  }

  static loaderOptions<T extends GuestGroupBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T, Viewer> {
    return {
      tableName: guestGroupLoaderInfo.tableName,
      fields: guestGroupLoaderInfo.fields,
      ent: this,
      loaderFactory: guestGroupLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (GuestGroupBase.schemaFields != null) {
      return GuestGroupBase.schemaFields;
    }
    return (GuestGroupBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return GuestGroupBase.getSchemaFields().get(key);
  }

  queryGuestGroupToInvitedEvents(): GuestGroupToInvitedEventsQuery {
    return GuestGroupToInvitedEventsQuery.query(this.viewer, this.id);
  }

  queryGuests(): GuestGroupToGuestsQuery {
    return GuestGroupToGuestsQuery.query(this.viewer, this.id);
  }

  async loadEvent(): Promise<Event | null> {
    return loadEnt(this.viewer, this.eventID, Event.loaderOptions());
  }

  loadEventX(): Promise<Event> {
    return loadEntX(this.viewer, this.eventID, Event.loaderOptions());
  }
}
