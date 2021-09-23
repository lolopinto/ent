// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AllowIfViewerPrivacyPolicy,
  Context,
  CustomQuery,
  Data,
  ID,
  LoadEntOptions,
  ObjectLoaderFactory,
  PrivacyPolicy,
  Viewer,
  convertDate,
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
  EventToEventActivitiesQuery,
  EventToGuestDataQuery,
  EventToGuestGroupsQuery,
  EventToGuestsQuery,
  NodeType,
  User,
} from "src/ent/internal";
import schema from "src/schema/event";

const tableName = "events";
const fields = ["id", "created_at", "updated_at", "name", "slug", "creator_id"];

export class EventBase {
  readonly nodeType = NodeType.Event;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly slug: string | null;
  readonly creatorID: ID;

  constructor(public viewer: Viewer, protected data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.name = data.name;
    this.slug = data.slug;
    this.creatorID = data.creator_id;
  }

  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends EventBase>(
    this: new (viewer: Viewer, data: Data) => T,
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
    this: new (viewer: Viewer, data: Data) => T,
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
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return (await loadEnts(
      viewer,
      EventBase.loaderOptions.apply(this),
      ...ids,
    )) as T[];
  }

  static async loadCustom<T extends EventBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      EventBase.loaderOptions.apply(this),
      query,
    )) as T[];
  }

  static async loadCustomData<T extends EventBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<Data[]> {
    return loadCustomData(EventBase.loaderOptions.apply(this), query, context);
  }

  static async loadRawData<T extends EventBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await eventLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends EventBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await eventLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static async loadFromSlug<T extends EventBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    slug: string,
  ): Promise<T | null> {
    return (await loadEntViaKey(viewer, slug, {
      ...EventBase.loaderOptions.apply(this),
      loaderFactory: eventSlugLoader,
    })) as T | null;
  }

  static async loadFromSlugX<T extends EventBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    slug: string,
  ): Promise<T> {
    return (await loadEntXViaKey(viewer, slug, {
      ...EventBase.loaderOptions.apply(this),
      loaderFactory: eventSlugLoader,
    })) as T;
  }

  static async loadIDFromSlug<T extends EventBase>(
    this: new (viewer: Viewer, data: Data) => T,
    slug: string,
    context?: Context,
  ): Promise<ID | undefined> {
    const row = await eventSlugLoader.createLoader(context).load(slug);
    return row?.id;
  }

  static async loadRawDataFromSlug<T extends EventBase>(
    this: new (viewer: Viewer, data: Data) => T,
    slug: string,
    context?: Context,
  ): Promise<Data | null> {
    return await eventSlugLoader.createLoader(context).load(slug);
  }

  static loaderOptions<T extends EventBase>(
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: fields,
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

export const eventLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "id",
});

export const eventSlugLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  key: "slug",
});

eventLoader.addToPrime(eventSlugLoader);
eventSlugLoader.addToPrime(eventLoader);
