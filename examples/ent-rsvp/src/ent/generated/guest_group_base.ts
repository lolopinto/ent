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
  GuestGroupToInvitedEventsQuery,
  GuestGroupToGuestsQuery,
} from "src/ent/internal";
import schema from "src/schema/guest_group";

const tableName = "guest_groups";

export class GuestGroupBase {
  readonly nodeType = NodeType.GuestGroup;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly invitationName: string;
  readonly eventID: ID;

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = id;
    // TODO don't double read id
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.invitationName = data.invitation_name;
    this.eventID = data.event_id;
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };

  static async load<T extends GuestGroupBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, GuestGroupBase.loaderOptions.apply(this));
  }

  static async loadX<T extends GuestGroupBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, GuestGroupBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends GuestGroupBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, GuestGroupBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends GuestGroupBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data | null> {
    return await loadRow({
      ...GuestGroupBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static async loadRawDataX<T extends GuestGroupBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data> {
    return await loadRowX({
      ...GuestGroupBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static loaderOptions<T extends GuestGroupBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: GuestGroupBase.getFields(),
      ent: this,
    };
  }

  private static getFields(): string[] {
    return ["id", "created_at", "updated_at", "invitation_name", "event_id"];
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
