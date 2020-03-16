import {
  EventBase,
  EventCreateInput,
  EventEditInput,
  createEventFrom,
  editEventFrom,
  deleteEvent,
} from "./generated/event_base";
import { ID, Viewer } from "ent/ent";
import { PrivacyPolicy, AlwaysAllowRule } from "ent/privacy";

// we're only writing this once except with --force and packageName provided
export default class Event extends EventBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [AlwaysAllowRule],
  };
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
