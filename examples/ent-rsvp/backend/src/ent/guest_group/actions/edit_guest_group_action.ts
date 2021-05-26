import {
  EditGuestGroupActionBase,
  GuestGroupEditInput,
} from "src/ent/guest_group/actions/generated/edit_guest_group_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";

export { GuestGroupEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditGuestGroupAction extends EditGuestGroupActionBase {
  getPrivacyPolicy() {
    // only creator of event can edit guest group
    return new AllowIfEventCreatorPrivacyPolicy(
      this.builder.existingEnt!.eventID,
    );
  }
}
