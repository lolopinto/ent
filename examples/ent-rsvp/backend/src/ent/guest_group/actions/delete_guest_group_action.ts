import { DeleteGuestGroupActionBase } from "../../generated/guest_group/actions/delete_guest_group_action_base.js";
import { AllowIfEventCreatorPrivacyPolicy } from "../../event/privacy/event_creator.js";

// we're only writing this once except with --force and packageName provided
export default class DeleteGuestGroupAction extends DeleteGuestGroupActionBase {
  getPrivacyPolicy() {
    // only creator of event can delete guest group
    return new AllowIfEventCreatorPrivacyPolicy(
      this.builder.existingEnt!.eventId,
    );
  }
}
