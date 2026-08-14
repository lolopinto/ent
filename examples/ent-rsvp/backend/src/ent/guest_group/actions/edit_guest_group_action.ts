import { EditGuestGroupActionBase } from "../../generated/guest_group/actions/edit_guest_group_action_base.js";
import type { GuestGroupEditInput } from "../../generated/guest_group/actions/edit_guest_group_action_base.js";
import { AllowIfEventCreatorPrivacyPolicy } from "../../event/privacy/event_creator.js";

export type { GuestGroupEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditGuestGroupAction extends EditGuestGroupActionBase {
  getPrivacyPolicy() {
    // only creator of event can edit guest group
    return new AllowIfEventCreatorPrivacyPolicy(
      this.builder.existingEnt.eventId,
    );
  }
}
