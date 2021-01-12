import { DeleteGuestActionBase } from "src/ent/guest/actions/generated/delete_guest_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";

// we're only writing this once except with --force and packageName provided
export default class DeleteGuestAction extends DeleteGuestActionBase {
  getPrivacyPolicy() {
    // only creator of event can delete guest
    return new AllowIfEventCreatorPrivacyPolicy(
      this.builder.existingEnt!.eventID,
    );
  }
}
