import { EditGuestActionBase } from "../../generated/guest/actions/edit_guest_action_base.js";
import type { GuestEditInput } from "../../generated/guest/actions/edit_guest_action_base.js";
import { AllowIfEventCreatorRule } from "../../event/privacy/event_creator.js";
import { AllowIfGuestInSameGuestGroupRule } from "../privacy/guest_rule_privacy.js";
import { AlwaysDenyRule } from "@snowtop/ent";

export type { GuestEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditGuestAction extends EditGuestActionBase {
  getPrivacyPolicy() {
    return {
      rules: [
        // creator of event can edit guest
        new AllowIfEventCreatorRule(this.builder.existingEnt.eventId),
        // guest details can be edited by guest in same guest group
        new AllowIfGuestInSameGuestGroupRule(this.builder.existingEnt!.id),
        AlwaysDenyRule,
      ],
    };
  }
}
