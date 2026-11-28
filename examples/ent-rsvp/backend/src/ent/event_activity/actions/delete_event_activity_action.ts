import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";
import { DeleteEventActivityActionBase } from "src/ent/generated/event_activity/actions/delete_event_activity_action_base";

// we're only writing this once except with --force and packageName provided
export default class DeleteEventActivityAction extends DeleteEventActivityActionBase {
  getPrivacyPolicy() {
    return new AllowIfEventCreatorPrivacyPolicy(this.eventActivity.eventId);
  }
}
