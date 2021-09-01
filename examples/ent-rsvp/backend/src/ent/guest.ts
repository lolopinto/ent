import { GuestBase } from "src/ent/internal";
import { AllowIfViewerRule, AlwaysDenyRule, PrivacyPolicy } from "@snowtop/ent";
import { AllowIfEventCreatorRule } from "src/ent/event/privacy/event_creator";
import { AllowIfGuestInSameGuestGroupRule } from "src/ent/guest/privacy/guest_rule_privacy";

// we're only writing this once except with --force and packageName provided
export class Guest extends GuestBase {
  privacyPolicy: PrivacyPolicy = {
    rules: [
      // guest can view self
      AllowIfViewerRule,
      // can view guest group if creator of event
      new AllowIfEventCreatorRule(this.eventID),
      new AllowIfGuestInSameGuestGroupRule(),
      AlwaysDenyRule,
    ],
  };
}
