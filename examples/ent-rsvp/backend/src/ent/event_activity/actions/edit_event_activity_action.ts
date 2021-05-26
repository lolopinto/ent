import {
  EditEventActivityActionBase,
  EventActivityEditInput,
} from "src/ent/event_activity/actions/generated/edit_event_activity_action_base";

export { EventActivityEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditEventActivityAction extends EditEventActivityActionBase {}
