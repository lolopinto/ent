import {
  EditGuestActionBase,
  GuestEditInput,
} from "src/ent/guest/actions/generated/edit_guest_action_base";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";

export { GuestEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditGuestAction extends EditGuestActionBase {
  getPrivacyPolicy() {
    // only creator of event can edit guest
    return new AllowIfEventCreatorPrivacyPolicy(
      this.builder.existingEnt!.eventID,
    );
  }
}
