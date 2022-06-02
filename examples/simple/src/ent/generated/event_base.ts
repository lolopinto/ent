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
  applyPrivacyPolicy,
  convertDate,
  convertNullableDate,
  getEdgeTypeInGroup,
  loadCustomData,
  loadCustomEnts,
  loadEnt,
  loadEntX,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields, getFieldsWithPrivacy } from "@snowtop/ent/schema";
import { eventLoader, eventLoaderInfo } from "./loaders";
import {
  Address,
  EdgeType,
  EventToAttendingQuery,
  EventToDeclinedQuery,
  EventToHostsQuery,
  EventToInvitedQuery,
  EventToMaybeQuery,
  NodeType,
  User,
} from "../internal";
import schema from "../../schema/event_schema";
import { ExampleViewer } from "../../viewer/viewer";

export enum EventRsvpStatus {
  Attending = "attending",
  Declined = "declined",
  Maybe = "maybe",
  CanRsvp = "canRsvp",
}

interface EventDBData {
  id: ID;
  created_at: Date;
  updated_at: Date;
  name: string;
  user_id: ID;
  start_time: Date;
  end_time: Date | null;
  location: string;
  address_id: ID | null;
}

export class EventBase
  // TODO implements IFeedback etc
  implements Ent<ExampleViewer>
{
  readonly nodeType = NodeType.Event;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly creatorID: ID;
  readonly startTime: Date;
  readonly endTime: Date | null;
  readonly location: string;
  protected readonly _addressID: ID | null;

  constructor(public viewer: ExampleViewer, protected data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.name = data.name;
    this.creatorID = data.user_id;
    this.startTime = convertDate(data.start_time);
    this.endTime = convertNullableDate(data.end_time);
    this.location = data.location;
    this._addressID = data.address_id;
  }

  getPrivacyPolicy(): PrivacyPolicy<this, ExampleViewer> {
    return AllowIfViewerPrivacyPolicy;
  }

  async addressID(): Promise<ID | null> {
    if (this._addressID === null) {
      return null;
    }
    const m = getFieldsWithPrivacy(schema, eventLoaderInfo.fieldInfo);
    const p = m.get("address_id");
    if (!p) {
      throw new Error(`couldn't get field privacy policy for addressID`);
    }
    const v = await applyPrivacyPolicy(this.viewer, p, this);
    return v ? this._addressID : null;
  }

  static async load<T extends EventBase>(
    this: new (viewer: ExampleViewer, data: Data) => T,
    viewer: ExampleViewer,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      EventBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends EventBase>(
    this: new (viewer: ExampleViewer, data: Data) => T,
    viewer: ExampleViewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      EventBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends EventBase>(
    this: new (viewer: ExampleViewer, data: Data) => T,
    viewer: ExampleViewer,
    ...ids: ID[]
  ): Promise<Map<ID, T>> {
    return (await loadEnts(
      viewer,
      EventBase.loaderOptions.apply(this),
      ...ids,
    )) as Map<ID, T>;
  }

  static async loadCustom<T extends EventBase>(
    this: new (viewer: ExampleViewer, data: Data) => T,
    viewer: ExampleViewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      EventBase.loaderOptions.apply(this),
      query,
    )) as T[];
  }

  static async loadCustomData<T extends EventBase>(
    this: new (viewer: ExampleViewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<EventDBData[]> {
    return (await loadCustomData(
      EventBase.loaderOptions.apply(this),
      query,
      context,
    )) as EventDBData[];
  }

  static async loadRawData<T extends EventBase>(
    this: new (viewer: ExampleViewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<EventDBData | null> {
    const row = await eventLoader.createLoader(context).load(id);
    if (!row) {
      return null;
    }
    return row as EventDBData;
  }

  static async loadRawDataX<T extends EventBase>(
    this: new (viewer: ExampleViewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<EventDBData> {
    const row = await eventLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row as EventDBData;
  }

  static loaderOptions<T extends EventBase>(
    this: new (viewer: ExampleViewer, data: Data) => T,
  ): LoadEntOptions<T, ExampleViewer> {
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

  getEventRsvpStatusMap() {
    let m: Map<EventRsvpStatus, EdgeType> = new Map();
    m.set(EventRsvpStatus.Attending, EdgeType.EventToAttending);
    m.set(EventRsvpStatus.Declined, EdgeType.EventToDeclined);
    m.set(EventRsvpStatus.Maybe, EdgeType.EventToMaybe);
    return m;
  }

  async viewerRsvpStatus(): Promise<EventRsvpStatus> {
    const ret = EventRsvpStatus.CanRsvp;
    if (!this.viewer.viewerID) {
      return ret;
    }
    const g = await getEdgeTypeInGroup(
      this.viewer,
      this.id,
      this.viewer.viewerID!,
      this.getEventRsvpStatusMap(),
    );
    if (g) {
      return g[0];
    }
    return ret;
  }

  queryAttending(): EventToAttendingQuery {
    return EventToAttendingQuery.query(this.viewer, this.id);
  }

  queryDeclined(): EventToDeclinedQuery {
    return EventToDeclinedQuery.query(this.viewer, this.id);
  }

  queryHosts(): EventToHostsQuery {
    return EventToHostsQuery.query(this.viewer, this.id);
  }

  queryInvited(): EventToInvitedQuery {
    return EventToInvitedQuery.query(this.viewer, this.id);
  }

  queryMaybe(): EventToMaybeQuery {
    return EventToMaybeQuery.query(this.viewer, this.id);
  }

  async loadAddress(): Promise<Address | null> {
    const addressID = await this.addressID();
    if (!addressID) {
      return null;
    }

    return loadEnt(this.viewer, addressID, Address.loaderOptions());
  }

  async loadCreator(): Promise<User | null> {
    return loadEnt(this.viewer, this.creatorID, User.loaderOptions());
  }

  loadCreatorX(): Promise<User> {
    return loadEntX(this.viewer, this.creatorID, User.loaderOptions());
  }
}
