import {
  EventBase,
  EventCreateInput,
  EventEditInput,
  createEventFrom,
  editEventFrom,
  deleteEvent,
} from "./generated/event_base";
import { ID, Viewer } from "ent/ent";

// we're only writing this once except with --force and packageName provided
export default class Event extends EventBase {
  static async load(viewer: Viewer, id: ID): Promise<Event | null> {
    return Event.loadFrom(viewer, id, Event);
  }

  static async loadX(viewer: Viewer, id: ID): Promise<Event> {
    return Event.loadXFrom(viewer, id, Event);
  }
}

// no actions yet so we support full create, edit, delete for now
export { EventCreateInput, EventEditInput, deleteEvent };

export async function createEvent(
  viewer: Viewer,
  input: EventCreateInput,
): Promise<Event | null> {
  return createEventFrom(viewer, input, Event);
}

export async function editEvent(
  viewer: Viewer,
  id: ID,
  input: EventEditInput,
): Promise<Event | null> {
  return editEventFrom(viewer, id, input, Event);
}
