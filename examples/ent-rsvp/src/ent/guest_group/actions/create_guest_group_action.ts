import {
  CreateGuestGroupActionBase,
  GuestGroupCreateInput,
} from "src/ent/guest_group/actions/generated/create_guest_group_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";

export { GuestGroupCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateGuestGroupAction extends CreateGuestGroupActionBase {
  getPrivacyPolicy() {
    // only creator of event can create guest group
    return new AllowIfEventCreatorPrivacyPolicy(this.input.eventID);
  }
}
