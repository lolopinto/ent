import { EditEventActivityActionBase } from "../../generated/event_activity/actions/edit_event_activity_action_base.js";
import type { EventActivityEditInput } from "../../generated/event_activity/actions/edit_event_activity_action_base.js";

export type { EventActivityEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditEventActivityAction extends EditEventActivityActionBase {}
