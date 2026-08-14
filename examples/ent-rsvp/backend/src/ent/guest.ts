import { GuestBase } from "./internal.js";
import { AllowIfViewerRule, AlwaysDenyRule, PrivacyPolicy } from "@snowtop/ent";
import { AllowIfEventCreatorRule } from "./event/privacy/event_creator.js";
import { AllowIfGuestInSameGuestGroupRule } from "./guest/privacy/guest_rule_privacy.js";

// we're only writing this once except with --force and packageName provided
export class Guest extends GuestBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [
        // guest can view self
        AllowIfViewerRule,
        // can view guest group if creator of event
        new AllowIfEventCreatorRule(this.eventId),
        new AllowIfGuestInSameGuestGroupRule(),
        AlwaysDenyRule,
      ],
    };
  }
}
