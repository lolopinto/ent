import { DeleteGuestActionBase } from "../../generated/guest/actions/delete_guest_action_base.js";
import { AllowIfEventCreatorPrivacyPolicy } from "../../event/privacy/event_creator.js";

// we're only writing this once except with --force and packageName provided
export default class DeleteGuestAction extends DeleteGuestActionBase {
  getPrivacyPolicy() {
    // only creator of event can delete guest
    return new AllowIfEventCreatorPrivacyPolicy(
      this.builder.existingEnt.eventId,
    );
  }
}
