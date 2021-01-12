import {
  CreateGuestActionBase,
  GuestCreateInput,
} from "src/ent/guest/actions/generated/create_guest_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";

export { GuestCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestAction extends CreateGuestActionBase {
  getPrivacyPolicy() {
    // only creator of event can create guest
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventID);
  }
}
