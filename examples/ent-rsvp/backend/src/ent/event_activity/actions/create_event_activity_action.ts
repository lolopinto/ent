import { AlwaysDenyRule } from "@lolopinto/ent";
import {
  CreateEventActivityActionBase,
  EventActivityCreateInput,
} from "src/ent/event_activity/actions/generated/create_event_activity_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";
export { EventActivityCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateEventActivityAction extends CreateEventActivityActionBase {
  getPrivacyPolicy() {
    // only creator of event can create activity
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventID);
  }
}
