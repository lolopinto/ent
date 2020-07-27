// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  loadEnt,
  ID,
  Viewer,
  loadEntX,
  loadEnts,
  LoadEntOptions,
  AssocEdge,
  loadEdges,
  loadRawEdgeCountX,
  loadNodesByEdge,
  loadEdgeForID2,
} from "ent/ent";
import { AlwaysDenyRule, PrivacyPolicy } from "ent/privacy";
import { Field, getFields } from "ent/schema";
import schema from "src/schema/event";
import { EdgeType, NodeType } from "src/ent/const";
import User from "src/ent/user";

const tableName = "events";

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

  constructor(public viewer: Viewer, id: ID, data: {}) {
    this.id = id;
    // TODO don't double read id
    this.id = data["id"];
    this.createdAt = data["created_at"];
    this.updatedAt = data["updated_at"];
    this.name = data["name"];
    this.creatorID = data["user_id"];
    this.startTime = data["start_time"];
    this.endTime = data["end_time"];
    this.location = data["location"];
  }

  // by default, we always deny and it's up to the ent
  // to overwrite this privacy policy in its subclasses

  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysDenyRule],
  };

  static async load<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T | null> {
    return loadEnt(viewer, id, EventBase.loaderOptions.apply(this));
  }

  static async loadX<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, EventBase.loaderOptions.apply(this));
  }

  static async loadMany<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, EventBase.loaderOptions.apply(this), ...ids);
  }

  static loaderOptions<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
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

  loadHostsEdges(): Promise<AssocEdge[]> {
    return loadEdges({
      id1: this.id,
      edgeType: EdgeType.EventToHosts,
      context: this.viewer.context,
    });
  }

  loadHosts(): Promise<User[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.EventToHosts,
      User.loaderOptions(),
    );
  }

  loadHostsRawCountX(): Promise<number> {
    return loadRawEdgeCountX({
      id1: this.id,
      edgeType: EdgeType.EventToHosts,
      context: this.viewer.context,
    });
  }

  loadHostEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.EventToHosts,
      id2,
      context: this.viewer.context,
    });
  }

  loadInvitedEdges(): Promise<AssocEdge[]> {
    return loadEdges({
      id1: this.id,
      edgeType: EdgeType.EventToInvited,
      context: this.viewer.context,
    });
  }

  loadInvited(): Promise<User[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.EventToInvited,
      User.loaderOptions(),
    );
  }

  loadInvitedRawCountX(): Promise<number> {
    return loadRawEdgeCountX({
      id1: this.id,
      edgeType: EdgeType.EventToInvited,
      context: this.viewer.context,
    });
  }

  loadInvitedEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.EventToInvited,
      id2,
      context: this.viewer.context,
    });
  }

  loadAttendingEdges(): Promise<AssocEdge[]> {
    return loadEdges({
      id1: this.id,
      edgeType: EdgeType.EventToAttending,
      context: this.viewer.context,
    });
  }

  loadAttending(): Promise<User[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.EventToAttending,
      User.loaderOptions(),
    );
  }

  loadAttendingRawCountX(): Promise<number> {
    return loadRawEdgeCountX({
      id1: this.id,
      edgeType: EdgeType.EventToAttending,
      context: this.viewer.context,
    });
  }

  loadAttendingEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.EventToAttending,
      id2,
      context: this.viewer.context,
    });
  }

  loadDeclinedEdges(): Promise<AssocEdge[]> {
    return loadEdges({
      id1: this.id,
      edgeType: EdgeType.EventToDeclined,
      context: this.viewer.context,
    });
  }

  loadDeclined(): Promise<User[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.EventToDeclined,
      User.loaderOptions(),
    );
  }

  loadDeclinedRawCountX(): Promise<number> {
    return loadRawEdgeCountX({
      id1: this.id,
      edgeType: EdgeType.EventToDeclined,
      context: this.viewer.context,
    });
  }

  loadDeclinedEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.EventToDeclined,
      id2,
      context: this.viewer.context,
    });
  }

  loadMaybeEdges(): Promise<AssocEdge[]> {
    return loadEdges({
      id1: this.id,
      edgeType: EdgeType.EventToMaybe,
      context: this.viewer.context,
    });
  }

  loadMaybe(): Promise<User[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.EventToMaybe,
      User.loaderOptions(),
    );
  }

  loadMaybeRawCountX(): Promise<number> {
    return loadRawEdgeCountX({
      id1: this.id,
      edgeType: EdgeType.EventToMaybe,
      context: this.viewer.context,
    });
  }

  loadMaybeEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2({
      id1: this.id,
      edgeType: EdgeType.EventToMaybe,
      id2,
      context: this.viewer.context,
    });
  }

  loadCreator(): Promise<User | null> {
    return loadEnt(this.viewer, this.creatorID, User.loaderOptions());
  }

  loadCreatorX(): Promise<User> {
    return loadEntX(this.viewer, this.creatorID, User.loaderOptions());
  }
}
