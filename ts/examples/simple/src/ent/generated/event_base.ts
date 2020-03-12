// these are dependent on having the right tsconfig.json file...
import {
  loadEnt,
  ID,
  Viewer,
  loadEntX,
  LoadEntOptions,
  createEnt,
  editEnt,
  deleteEnt,
} from "ent/ent";
import { AlwaysDenyRule, PrivacyPolicy } from "ent/privacy";
import { Field, getFields } from "ent/schema";
import schema from "src/schema/event";

const tableName = "events";

export abstract class EventBase {
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

  protected static async loadFrom<T extends EventBase>(
    viewer: Viewer,
    id: ID,
    arg: new (viewer: Viewer, id: ID, data: {}) => T
  ): Promise<T | null> {
    return loadEnt(viewer, id, EventBase.getOptions(arg));
  }

  protected static async loadXFrom<T extends EventBase>(
    viewer: Viewer,
    id: ID,
    arg: new (viewer: Viewer, id: ID, data: {}) => T
  ): Promise<T> {
    return loadEntX(viewer, id, EventBase.getOptions(arg));
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

  private static getOptions<T extends EventBase>(
    arg: new (viewer: Viewer, id: ID, data: {}) => T
  ): LoadEntOptions<T> {
    return {
      tableName: tableName,
      fields: EventBase.getFields(),
      ent: arg,
    };
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
  arg: new (viewer: Viewer, id: ID, data: {}) => T
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
  arg: new (viewer: Viewer, id: ID, data: {}) => T
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
