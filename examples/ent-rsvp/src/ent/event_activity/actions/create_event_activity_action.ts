import {
  CreateEventActivityActionBase,
  EventActivityCreateInput,
} from "src/ent/event_activity/actions/generated/create_event_activity_action_base";

export { EventActivityCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateEventActivityAction extends CreateEventActivityActionBase {}
