import {
  loadEnt,
  ID,
  Viewer,
  loadEntX,
  LoadEntOptions,
  createEnt,
  editEnt,
  deleteEnt,
} from "../../../../src/ent";
import { Field, getFields } from "../../../../src/schema";
import schema from "./../schema/event";

const tableName = "events";

export default class Event {
  readonly id: ID;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly name: string;
  readonly creatorID: string;
  readonly startTime: Date;
  readonly endTime: Date | null;
  readonly location: string;

  constructor(viewer: Viewer, id: ID, options: {}) {
    this.id = id;
    // TODO don't double read id
    this.id = options["id"];
    this.createdAt = options["created_at"];
    this.updatedAt = options["updated_at"];
    this.name = options["name"];
    this.creatorID = options["user_id"];
    this.startTime = options["start_time"];
    this.endTime = options["end_time"];
    this.location = options["location"];
  }

  static async load(viewer: Viewer, id: ID): Promise<Event | null> {
    return loadEnt(viewer, id, Event.getOptions());
  }

  static async loadX(viewer: Viewer, id: ID): Promise<Event> {
    return loadEntX(viewer, id, Event.getOptions());
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
    if (Event.schemaFields != null) {
      return Event.schemaFields;
    }
    return (Event.schemaFields = getFields(schema));
  }

  static getField(key: string): Field | undefined {
    return Event.getSchemaFields().get(key);
  }

  private static getOptions(): LoadEntOptions<Event> {
    return {
      tableName: tableName,
      fields: Event.getFields(),
      ent: Event,
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
  let fn = Event.getField(key)?.[property];
  if (!fn) {
    return null;
  }
  return fn();
}

export async function createEvent(
  viewer: Viewer,
  input: EventCreateInput
): Promise<Event | null> {
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
    ent: Event,
  });
}

export async function editEvent(
  viewer: Viewer,
  id: ID,
  input: EventEditInput
): Promise<Event | null> {
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
    ent: Event,
  });
}

export async function deleteEvent(viewer: Viewer, id: ID): Promise<null> {
  return await deleteEnt(viewer, id, {
    tableName: tableName,
  });
}
