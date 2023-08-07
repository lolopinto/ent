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
  loadEntViaKey,
  loadEntX,
  loadEntXViaKey,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields } from "@snowtop/ent/schema";
import {
  EventDBData,
  eventLoader,
  eventLoaderInfo,
  eventSlugLoader,
} from "src/ent/generated/loaders";
import { NodeType } from "src/ent/generated/types";
import {
  EventToEventActivitiesQuery,
  EventToGuestDataQuery,
  EventToGuestGroupsQuery,
  EventToGuestsQuery,
  User,
} from "src/ent/internal";
import schema from "src/schema/event_schema";

export class EventBase implements Ent<Viewer> {
  protected readonly data: EventDBData;
  readonly nodeType = NodeType.Event;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly slug: string | null;
  readonly creatorID: ID;

  constructor(public viewer: Viewer, data: Data) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.name = data.name;
    this.slug = data.slug;
    this.creatorID = data.creator_id;
    // @ts-expect-error
    this.data = data;
  }

  __setRawDBData<EventDBData>(data: EventDBData) {}

  /** used by some ent internals to get access to raw db data. should not be depended on. may not always be on the ent **/
  ___getRawDBData(): EventDBData {
    return this.data;
  }

  getPrivacyPolicy(): PrivacyPolicy<this, Viewer> {
    return AllowIfViewerPrivacyPolicy;
  }

  static async load<T extends EventBase>(
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
      EventBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends EventBase>(
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
      EventBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends EventBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      EventBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends EventBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    viewer: Viewer,
    query: CustomQuery<EventDBData>,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      {
        ...EventBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
    )) as T[];
  }

  static async loadCustomData<T extends EventBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    query: CustomQuery<EventDBData>,
    context?: Context,
  ): Promise<EventDBData[]> {
    return loadCustomData<EventDBData, EventDBData>(
      {
        ...EventBase.loaderOptions.apply(this),
        prime: true,
      },
      query,
      context,
    );
  }

  static async loadCustomCount<T extends EventBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    query: CustomQuery<EventDBData>,
    context?: Context,
  ): Promise<number> {
    return loadCustomCount(
      {
        ...EventBase.loaderOptions.apply(this),
      },
      query,
      context,
    );
  }

  static async loadRawData<T extends EventBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<EventDBData | null> {
    return eventLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends EventBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    id: ID,
    context?: Context,
  ): Promise<EventDBData> {
    const row = await eventLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static async loadFromSlug<T extends EventBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    viewer: Viewer,
    slug: string,
  ): Promise<T | null> {
    return (await loadEntViaKey(viewer, slug, {
      ...EventBase.loaderOptions.apply(this),
      loaderFactory: eventSlugLoader,
    })) as T | null;
  }

  static async loadFromSlugX<T extends EventBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    viewer: Viewer,
    slug: string,
  ): Promise<T> {
    return (await loadEntXViaKey(viewer, slug, {
      ...EventBase.loaderOptions.apply(this),
      loaderFactory: eventSlugLoader,
    })) as T;
  }

  static async loadIDFromSlug<T extends EventBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    slug: string,
    context?: Context,
  ): Promise<ID | undefined> {
    const row = await eventSlugLoader.createLoader(context).load(slug);
    return row?.id;
  }

  static async loadRawDataFromSlug<T extends EventBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
    slug: string,
    context?: Context,
  ): Promise<EventDBData | null> {
    return eventSlugLoader.createLoader(context).load(slug);
  }

  static loaderOptions<T extends EventBase>(
    this: new (
      viewer: Viewer,
      data: Data,
    ) => T,
  ): LoadEntOptions<T, Viewer, EventDBData> {
    return {
      tableName: eventLoaderInfo.tableName,
      fields: eventLoaderInfo.fields,
      ent: this,
      loaderFactory: eventLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (EventBase.schemaFields != null) {
      return EventBase.schemaFields;
    }
    return (EventBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return EventBase.getSchemaFields().get(key);
  }

  queryEventActivities(): EventToEventActivitiesQuery {
    return EventToEventActivitiesQuery.query(this.viewer, this.id);
  }

  queryGuestData(): EventToGuestDataQuery {
    return EventToGuestDataQuery.query(this.viewer, this.id);
  }

  queryGuestGroups(): EventToGuestGroupsQuery {
    return EventToGuestGroupsQuery.query(this.viewer, this.id);
  }

  queryGuests(): EventToGuestsQuery {
    return EventToGuestsQuery.query(this.viewer, this.id);
  }

  async loadCreator(): Promise<User | null> {
    return loadEnt(this.viewer, this.creatorID, User.loaderOptions());
  }

  loadCreatorX(): Promise<User> {
    return loadEntX(this.viewer, this.creatorID, User.loaderOptions());
  }
}
