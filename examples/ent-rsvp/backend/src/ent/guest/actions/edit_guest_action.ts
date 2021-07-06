import {
  EditGuestActionBase,
  GuestEditInput,
} from "src/ent/guest/actions/generated/edit_guest_action_base";
import { AllowIfEventCreatorRule } from "src/ent/event/privacy/event_creator";
import { AllowIfGuestInSameGuestGroupRule } from "src/ent/guest/privacy/guest_rule_privacy";
import { AlwaysDenyRule } from "@snowtop/ent";

export { GuestEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditGuestAction extends EditGuestActionBase {
  getPrivacyPolicy() {
    return {
      rules: [
        // creator of event can edit guest
        new AllowIfEventCreatorRule(this.builder.existingEnt!.eventID),
        // guest details can be edited by guest in same guest group
        new AllowIfGuestInSameGuestGroupRule(this.builder.existingEnt!.id),
        AlwaysDenyRule,
      ],
    };
  }
}
