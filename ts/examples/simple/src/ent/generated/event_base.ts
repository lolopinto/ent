// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  loadEnt,
  ID,
  Viewer,
  loadEntX,
  loadEnts,
  //  LoadEntOptions,
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
//import User from "src/ent/user";
import { UserInterface } from "src/ent/generated/interfaces";
import { UserLoader, EventLoader } from "./loaders";

//const tableName = "events";

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
    return loadEnt(viewer, id, EventLoader.loaderOptions());
  }

  static async loadX<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    id: ID,
  ): Promise<T> {
    return loadEntX(viewer, id, EventLoader.loaderOptions());
  }

  static async loadMany<T extends EventBase>(
    this: new (viewer: Viewer, id: ID, data: {}) => T,
    viewer: Viewer,
    ...ids: ID[]
  ): Promise<T[]> {
    return loadEnts(viewer, EventLoader.loaderOptions(), ...ids);
  }

  // static loaderOptions<T extends EventBase>(
  //   this: new (viewer: Viewer, id: ID, data: {}) => T,
  // ): LoadEntOptions<T> {
  //   return {
  //     tableName: tableName,
  //     fields: EventBase.getFields(),
  //     ent: this,
  //   };
  // }

  // private static getFields(): string[] {
  //   return [
  //     "id",
  //     "created_at",
  //     "updated_at",
  //     "name",
  //     "user_id",
  //     "start_time",
  //     "end_time",
  //     "location",
  //   ];
  // }

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
    return loadEdges(this.id, EdgeType.EventToHosts);
  }

  loadHosts(): Promise<UserInterface[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.EventToHosts,
      UserLoader.loaderOptions(),
    );
  }

  loadHostsRawCountX(): Promise<number> {
    return loadRawEdgeCountX(this.id, EdgeType.EventToHosts);
  }

  loadHostEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.EventToHosts, id2);
  }

  loadInvitedEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.EventToInvited);
  }

  loadInvited(): Promise<UserInterface[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.EventToInvited,
      UserLoader.loaderOptions(),
    );
  }

  loadInvitedRawCountX(): Promise<number> {
    return loadRawEdgeCountX(this.id, EdgeType.EventToInvited);
  }

  loadInvitedEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.EventToInvited, id2);
  }

  loadAttendingEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.EventToAttending);
  }

  loadAttending(): Promise<UserInterface[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.EventToAttending,
      UserLoader.loaderOptions(),
    );
  }

  loadAttendingRawCountX(): Promise<number> {
    return loadRawEdgeCountX(this.id, EdgeType.EventToAttending);
  }

  loadAttendingEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.EventToAttending, id2);
  }

  loadDeclinedEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.EventToDeclined);
  }

  loadDeclined(): Promise<UserInterface[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.EventToDeclined,
      UserLoader.loaderOptions(),
    );
  }

  loadDeclinedRawCountX(): Promise<number> {
    return loadRawEdgeCountX(this.id, EdgeType.EventToDeclined);
  }

  loadDeclinedEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.EventToDeclined, id2);
  }

  loadMaybeEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.EventToMaybe);
  }

  loadMaybe(): Promise<UserInterface[]> {
    return loadNodesByEdge(
      this.viewer,
      this.id,
      EdgeType.EventToMaybe,
      UserLoader.loaderOptions(),
    );
  }

  loadMaybeRawCountX(): Promise<number> {
    return loadRawEdgeCountX(this.id, EdgeType.EventToMaybe);
  }

  loadMaybeEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.EventToMaybe, id2);
  }

  loadCreator(): Promise<UserInterface | null> {
    return loadEnt(this.viewer, this.creatorID, UserLoader.loaderOptions());
  }

  loadCreatorX(): Promise<UserInterface> {
    return loadEntX(this.viewer, this.creatorID, UserLoader.loaderOptions());
  }
}
