import {
  EditEventRsvpStatusActionBase,
  EditEventRsvpStatusInput,
} from "src/ent/event/actions/generated/edit_event_rsvp_status_action_base";

export { EditEventRsvpStatusInput };

// we're only writing this once except with --force and packageName provided
export default class EditEventRsvpStatusAction extends EditEventRsvpStatusActionBase {}
