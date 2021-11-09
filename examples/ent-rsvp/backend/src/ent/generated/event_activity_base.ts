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
  convertBool,
  convertDate,
  convertNullableDate,
  getEdgeTypeInGroup,
  loadCustomData,
  loadCustomEnts,
  loadEnt,
  loadEntX,
  loadEnts,
} from "@snowtop/ent";
import { Field, getFields } from "@snowtop/ent/schema";
import {
  EdgeType,
  Event,
  EventActivityToAttendingQuery,
  EventActivityToDeclinedQuery,
  EventActivityToInvitesQuery,
  NodeType,
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

  constructor(public viewer: Viewer, protected data: Data) {
    this.id = data.id;
    this.createdAt = convertDate(data.created_at);
    this.updatedAt = convertDate(data.updated_at);
    this.name = data.name;
    this.eventID = data.event_id;
    this.startTime = convertDate(data.start_time);
    this.endTime = convertNullableDate(data.end_time);
    this.location = data.location;
    this.description = data.description;
    this.inviteAllGuests = convertBool(data.invite_all_guests);
  }

  privacyPolicy: PrivacyPolicy = AllowIfViewerPrivacyPolicy;

  static async load<T extends EventActivityBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return (await loadEnt(
      viewer,
      id,
      EventActivityBase.loaderOptions.apply(this),
    )) as T | null;
  }

  static async loadX<T extends EventActivityBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return (await loadEntX(
      viewer,
      id,
      EventActivityBase.loaderOptions.apply(this),
    )) as T;
  }

  static async loadMany<T extends EventActivityBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return (await loadEnts(
      viewer,
      EventActivityBase.loaderOptions.apply(this),
      ...ids,
    )) as T[];
  }

  static async loadCustom<T extends EventActivityBase>(
    this: new (viewer: Viewer, data: Data) => T,
    viewer: Viewer,
    query: CustomQuery,
  ): Promise<T[]> {
    return (await loadCustomEnts(
      viewer,
      EventActivityBase.loaderOptions.apply(this),
      query,
    )) as T[];
  }

  static async loadCustomData<T extends EventActivityBase>(
    this: new (viewer: Viewer, data: Data) => T,
    query: CustomQuery,
    context?: Context,
  ): Promise<Data[]> {
    return loadCustomData(
      EventActivityBase.loaderOptions.apply(this),
      query,
      context,
    );
  }

  static async loadRawData<T extends EventActivityBase>(
    this: new (viewer: Viewer, data: Data) => T,
    id: ID,
    context?: Context,
  ): Promise<Data | null> {
    return eventActivityLoader.createLoader(context).load(id);
  }

  static async loadRawDataX<T extends EventActivityBase>(
    this: new (viewer: Viewer, data: Data) => T,
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
    this: new (viewer: Viewer, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName,
      fields,
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
  key: "id",
});
