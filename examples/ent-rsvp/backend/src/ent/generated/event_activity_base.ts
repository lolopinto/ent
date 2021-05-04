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
  AlwaysDenyRule,
  AllowIfViewerRule,
  PrivacyPolicy,
  getEdgeTypeInGroup,
  ObjectLoaderFactory,
  Context,
} from "@lolopinto/ent";
import { Field, getFields } from "@lolopinto/ent/schema";
import {
  EdgeType,
  NodeType,
  Event,
  EventActivityToAttendingQuery,
  EventActivityToDeclinedQuery,
  EventActivityToInvitesQuery,
} from "src/ent/internal";
import schema from "src/schema/event_activity";

const tableName = "event_activities";
const fields = [
  "id",
  "created_at",
  "updated_at",
  "name",
  "event_id",
  "start_time",
  "end_time",
  "location",
  "description",
  "invite_all_guests",
];

export enum EventActivityRsvpStatus {
  Attending = "attending",
  Declined = "declined",
  CanRsvp = "canRsvp",
  CannotRsvp = "cannotRsvp",
}

export function getEventActivityRsvpStatusValues() {
  return [
    EventActivityRsvpStatus.Attending,
    EventActivityRsvpStatus.Declined,
    EventActivityRsvpStatus.CanRsvp,
    EventActivityRsvpStatus.CannotRsvp,
  ];
}

export class EventActivityBase {
  readonly nodeType = NodeType.EventActivity;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly eventID: ID;
  readonly startTime: Date;
  readonly endTime: Date | null;
  readonly location: string;
  readonly description: string | null;
  readonly inviteAllGuests: boolean;

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = id;
    // TODO don't double read id
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.name = data.name;
    this.eventID = data.event_id;
    this.startTime = data.start_time;
    this.endTime = data.end_time;
    this.location = data.location;
    this.description = data.description;
    this.inviteAllGuests = data.invite_all_guests;
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses
  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };

  static async load<T extends EventActivityBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, EventActivityBase.loaderOptions.apply(this));
  }

  static async loadX<T extends EventActivityBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, EventActivityBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends EventActivityBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(
      viewer,
      EventActivityBase.loaderOptions.apply(this),
      ...ids,
    );
  }

  static async loadRawData<T extends EventActivityBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return await eventActivityLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends EventActivityBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data> {
    const row = await eventActivityLoader.createLoader(context).load(id);
    if (!row) {
      throw new Error(`couldn't load row for ${id}`);
    }
    return row;
  }

  static loaderOptions<T extends EventActivityBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: fields,
      ent: this,
      loaderFactory: eventActivityLoader,
    };
  }

  private static schemaFields: Map<string, Field>;

  private static getSchemaFields(): Map<string, Field> {
    if (EventActivityBase.schemaFields != null) {
      return EventActivityBase.schemaFields;
    }
    return (EventActivityBase.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return EventActivityBase.getSchemaFields().get(key);
  }

  // this should be overwritten by subclasses as needed.
  protected async rsvpStatus() {
    return EventActivityRsvpStatus.CanRsvp;
  }

  getEventActivityRsvpStatusMap() {
    let m: Map<EventActivityRsvpStatus, EdgeType> = new Map();
    m.set(EventActivityRsvpStatus.Attending, EdgeType.EventActivityToAttending);
    m.set(EventActivityRsvpStatus.Declined, EdgeType.EventActivityToDeclined);
    return m;
  }

  async viewerRsvpStatus(): Promise<EventActivityRsvpStatus> {
    const ret = await this.rsvpStatus();
    if (!this.viewer.viewerID) {
      return ret;
    }
    const g = await getEdgeTypeInGroup(
      this.viewer,
      this.id,
      this.viewer.viewerID!,
      this.getEventActivityRsvpStatusMap(),
    );
    if (g) {
      return g[0];
    }
    return ret;
  }

  queryAttending(): EventActivityToAttendingQuery {
    return EventActivityToAttendingQuery.query(this.viewer, this.id);
  }

  queryDeclined(): EventActivityToDeclinedQuery {
    return EventActivityToDeclinedQuery.query(this.viewer, this.id);
  }

  queryInvites(): EventActivityToInvitesQuery {
    return EventActivityToInvitesQuery.query(this.viewer, this.id);
  }

  async loadEvent(): Promise<Event | null> {
    return loadEnt(this.viewer, this.eventID, Event.loaderOptions());
  }

  loadEventX(): Promise<Event> {
    return loadEntX(this.viewer, this.eventID, Event.loaderOptions());
  }
}

export const eventActivityLoader = new ObjectLoaderFactory({
  tableName,
  fields,
  pkey: "id",
});
