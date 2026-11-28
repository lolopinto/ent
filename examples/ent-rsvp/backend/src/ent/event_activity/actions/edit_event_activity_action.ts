import { AlwaysDenyRule } from "@snowtop/ent";
import {
  DenyIfNotEventCreatorRule,
  AllowIfEventCreatorRule,
} from "src/ent/event/privacy/event_creator";
import { EditEventActivityActionBase } from "src/ent/generated/event_activity/actions/edit_event_activity_action_base";
import type { EventActivityEditInput } from "src/ent/generated/event_activity/actions/edit_event_activity_action_base";

export type { EventActivityEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditEventActivityAction extends EditEventActivityActionBase {
  getPrivacyPolicy() {
    return {
      rules: [
        new DenyIfNotEventCreatorRule(this.eventActivity.eventId),
        new AllowIfEventCreatorRule(
          this.input.eventId ?? this.eventActivity.eventId,
        ),
        AlwaysDenyRule,
      ],
    };
  }
}
