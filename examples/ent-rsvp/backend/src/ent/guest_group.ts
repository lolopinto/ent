import { Guest, GuestGroupBase } from "src/ent/internal";
import {
  PrivacyPolicyRule,
  PrivacyPolicy,
  Viewer,
  Ent,
  Allow,
  Skip,
  AlwaysDenyRule,
} from "@snowtop/ent";
import { AllowIfEventCreatorRule } from "src/ent/event/privacy/event_creator";

class AllowIfGuestInGuestGroupRule implements PrivacyPolicyRule {
  async apply(viewer: Viewer, ent: GuestGroup | undefined) {
    if (!viewer.viewerID || !ent) {
      return Skip();
    }
    const data = await Guest.loadRawData(viewer.viewerID, viewer.context);
    if (data && data.guest_group_id == ent.id) {
      return Allow();
    }
    return Skip();
  }
}

// we're only writing this once except with --force and packageName provided
export class GuestGroup extends GuestGroupBase {
  // can view guest group if creator of event
  // guests in same guest group need to be able to see this...
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return {
      rules: [
        // can view guest group if creator of event
        new AllowIfEventCreatorRule(this.eventId),
        // can view guest group if guest
        new AllowIfGuestInGuestGroupRule(),
        AlwaysDenyRule,
      ],
    };
  }
}
