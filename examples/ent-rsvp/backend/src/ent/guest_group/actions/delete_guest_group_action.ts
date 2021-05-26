import { DeleteGuestGroupActionBase } from "src/ent/guest_group/actions/generated/delete_guest_group_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";

// we're only writing this once except with --force and packageName provided
export default class DeleteGuestGroupAction extends DeleteGuestGroupActionBase {
  getPrivacyPolicy() {
    // only creator of event can delete guest group
    return new AllowIfEventCreatorPrivacyPolicy(
      this.builder.existingEnt!.eventID,
    );
  }
}
