// these are dependent on having the right tsconfig.json file...
import {
  loadEnt,
  ID,
  Viewer,
  loadEntX,
  loadEnts,
  LoadEntOptions,
  createEnt,
  editEnt,
  deleteEnt,
  AssocEdge,
  loadEdges,
  loadRawEdgeCountX,
  loadNodesByEdge,
  loadEdgeForID2,
  loadEntsFromClause,
  loadEntFromClause,
  loadEntXFromClause,
  loadRow,
  loadUniqueEdge,
  loadUniqueNode,
} from "ent/ent";
import { AlwaysDenyRule, PrivacyPolicy } from "ent/privacy";
import { Field, getFields } from "ent/schema";
import schema from "src/schema/event";
import { EdgeType } from "src/ent/const";
import * as query from "ent/query";
import User from "src/ent/user";

const tableName = "events";

export class EventBase {
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly creatorID: string;
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
    return loadEdges(this.id, EdgeType.EventToHosts);
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
    return loadRawEdgeCountX(this.id, EdgeType.EventToHosts);
  }

  loadHostEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.EventToHosts, id2);
  }

  loadInvitedEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.EventToInvited);
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
    return loadRawEdgeCountX(this.id, EdgeType.EventToInvited);
  }

  loadInvitedEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.EventToInvited, id2);
  }

  loadAttendingEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.EventToAttending);
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
    return loadRawEdgeCountX(this.id, EdgeType.EventToAttending);
  }

  loadAttendingEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.EventToAttending, id2);
  }

  loadDeclinedEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.EventToDeclined);
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
    return loadRawEdgeCountX(this.id, EdgeType.EventToDeclined);
  }

  loadDeclinedEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.EventToDeclined, id2);
  }

  loadMaybeEdges(): Promise<AssocEdge[]> {
    return loadEdges(this.id, EdgeType.EventToMaybe);
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
    return loadRawEdgeCountX(this.id, EdgeType.EventToMaybe);
  }

  loadMaybeEdgeFor(id2: ID): Promise<AssocEdge | undefined> {
    return loadEdgeForID2(this.id, EdgeType.EventToMaybe, id2);
  }

  loadCreator(): Promise<User | null> {
    return loadEnt(this.viewer, this.creatorID, User.loaderOptions());
  }

  loadCreatorX(): Promise<User> {
    return loadEntX(this.viewer, this.creatorID, User.loaderOptions());
  }
}

// no actions yet so we support full create, edit, delete for now
export interface EventCreateInput {
  name: string;
  creatorID: string;
  startTime: Date;
  endTime?: Date | null;
  location: string;
}

export interface EventEditInput {
  name?: string;
  creatorID?: string;
  startTime?: Date;
  endTime?: Date | null;
  location?: string;
}

function defaultValue(key: string, property: string): any {
  let fn = EventBase.getField(key)?.[property];
  if (!fn) {
    return null;
  }
  return fn();
}

export async function createEventFrom<T extends EventBase>(
  viewer: Viewer,
  input: EventCreateInput,
  arg: new (viewer: Viewer, id: ID, data: {}) => T,
): Promise<T | null> {
  let fields = {
    id: defaultValue("ID", "defaultValueOnCreate"),
    created_at: defaultValue("createdAt", "defaultValueOnCreate"),
    updated_at: defaultValue("updatedAt", "defaultValueOnCreate"),
    name: input.name,
    user_id: input.creatorID,
    start_time: input.startTime,
    end_time: input.endTime,
    location: input.location,
  };

  return await createEnt(viewer, {
    tableName: tableName,
    fields: fields,
    ent: arg,
  });
}

export async function editEventFrom<T extends EventBase>(
  viewer: Viewer,
  id: ID,
  input: EventEditInput,
  arg: new (viewer: Viewer, id: ID, data: {}) => T,
): Promise<T | null> {
  const setField = function(key: string, value: any) {
    if (value !== undefined) {
      // nullable fields allowed
      fields[key] = value;
    }
  };
  let fields = {
    updated_at: defaultValue("updatedAt", "defaultValueOnEdit"),
  };
  setField("name", input.name);
  setField("user_id", input.creatorID);
  setField("start_time", input.startTime);
  setField("end_time", input.endTime);
  setField("location", input.location);

  return await editEnt(viewer, id, {
    tableName: tableName,
    fields: fields,
    ent: arg,
  });
}

export async function deleteEvent(viewer: Viewer, id: ID): Promise<null> {
  return await deleteEnt(viewer, id, {
    tableName: tableName,
  });
}
