// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  loadEnt,
  ID,
  Data,
  Viewer,
  loadEntX,
  loadEnts,
  LoadEntOptions,
  AssocEdge,
  loadRow,
  loadRowX,
  AlwaysDenyRule,
  AllowIfViewerRule,
  PrivacyPolicy,
  query,
} from "@lolopinto/ent";
import { Field, getFields } from "@lolopinto/ent/schema";
import {
  EdgeType,
  NodeType,
  Event,
  GuestGroup,
  GuestToAttendingEventsQuery,
  GuestToDeclinedEventsQuery,
  GuestToAuthCodesQuery,
  GuestToGuestDataQuery,
} from "src/ent/internal";
import schema from "src/schema/guest";

const tableName = "guests";

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

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = id;
    // TODO don't double read id
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.name = data.name;
    this.eventID = data.event_id;
    this.emailAddress = data.email_address;
    this.guestGroupID = data.guest_group_id;
    this.title = data.title;
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };

  static async load<T extends GuestBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, GuestBase.loaderOptions.apply(this));
  }

  static async loadX<T extends GuestBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, GuestBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends GuestBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, GuestBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends GuestBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data | null> {
    return await loadRow({
      ...GuestBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static async loadRawDataX<T extends GuestBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data> {
    return await loadRowX({
      ...GuestBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static loaderOptions<T extends GuestBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: GuestBase.getFields(),
      ent: this,
    };
  }

  private static getFields(): string[] {
    return [
      "id",
      "created_at",
      "updated_at",
      "name",
      "event_id",
      "email_address",
      "guest_group_id",
      "title",
    ];
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
