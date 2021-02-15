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
  loadEdgeForID2,
  loadRow,
  loadRowX,
  AlwaysDenyRule,
  AllowIfViewerRule,
  PrivacyPolicy,
  query,
  getEdgeTypeInGroup,
} from "@lolopinto/ent";
import { Field, getFields } from "@lolopinto/ent/schema";
import {
  EdgeType,
  NodeType,
  User,
  EventToAttendingQuery,
  EventToDeclinedQuery,
  EventToHostsQuery,
  EventToInvitedQuery,
  EventToMaybeQuery,
} from "src/ent/internal";
import schema from "src/schema/event";

const tableName = "events";

export enum EventRsvpStatus {
  Declined = "declined",
  Maybe = "maybe",
  Invited = "invited",
  Attending = "attending",
  CanRsvp = "canRsvp",
}

export function getEventRsvpStatusValues() {
  return [
    EventRsvpStatus.Declined,
    EventRsvpStatus.Maybe,
    EventRsvpStatus.Invited,
    EventRsvpStatus.Attending,
    EventRsvpStatus.CanRsvp,
  ];
}

export class EventBase {
  readonly nodeType = NodeType.Event;
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly creatorID: ID;
  readonly startTime: Date;
  readonly endTime: Date | null;
  readonly location: string;

  constructor(public viewer: Viewer, id: ID, data: Data) {
    this.id = id;
    // TODO don't double read id
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.name = data.name;
    this.creatorID = data.user_id;
    this.startTime = data.start_time;
    this.endTime = data.end_time;
    this.location = data.location;
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AllowIfViewerRule, AlwaysDenyRule],
  };

  static async load<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, EventBase.loaderOptions.apply(this));
  }

  static async loadX<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, EventBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, EventBase.loaderOptions.apply(this), ...ids);
  }

  static async loadRawData<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data | null> {
    return await loadRow({
      ...EventBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static async loadRawDataX<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
    id: ID,
  ): Promise<Data> {
    return await loadRowX({
      ...EventBase.loaderOptions.apply(this),
      clause: query.Eq("id", id),
    });
  }

  static loaderOptions<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: Data) => T,
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: EventBase.getFields(),
      ent: this,
    };
  }

  private static getFields(): string[] {
    return [
      "id",
      "created_at",
      "updated_at",
      "name",
      "user_id",
      "start_time",
      "end_time",
      "location",
    ];
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
    m.set(EventRsvpStatus.Invited, EdgeType.EventToInvited);
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

  loadAttendingEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.EventToAttending,
      id2,
      context: this.viewer.context,
    });
  }

  queryDeclined(): EventToDeclinedQuery {
    return EventToDeclinedQuery.query(this.viewer, this.id);
  }

  loadDeclinedEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.EventToDeclined,
      id2,
      context: this.viewer.context,
    });
  }

  queryHosts(): EventToHostsQuery {
    return EventToHostsQuery.query(this.viewer, this.id);
  }

  loadHostEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.EventToHosts,
      id2,
      context: this.viewer.context,
    });
  }

  queryInvited(): EventToInvitedQuery {
    return EventToInvitedQuery.query(this.viewer, this.id);
  }

  loadInvitedEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.EventToInvited,
      id2,
      context: this.viewer.context,
    });
  }

  queryMaybe(): EventToMaybeQuery {
    return EventToMaybeQuery.query(this.viewer, this.id);
  }

  loadMaybeEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.EventToMaybe,
      id2,
      context: this.viewer.context,
    });
  }

  async loadCreator(): Promise<User | null> {
    return loadEnt(this.viewer, this.creatorID, User.loaderOptions());
  }

  loadCreatorX(): Promise<User> {
    return loadEntX(this.viewer, this.creatorID, User.loaderOptions());
  }
}
