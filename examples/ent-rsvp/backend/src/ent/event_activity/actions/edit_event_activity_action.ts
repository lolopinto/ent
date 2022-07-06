import {
  EditEventActivityActionBase,
  EventActivityEditInput,
} from "src/ent/generated/event_activity/actions/edit_event_activity_action_base";

export { EventActivityEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditEventActivityAction extends EditEventActivityActionBase {}
