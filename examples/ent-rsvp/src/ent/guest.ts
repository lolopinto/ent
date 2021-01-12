import { GuestBase } from "src/ent/internal";
import {
  AllowIfViewerRule,
  AlwaysDenyRule,
  PrivacyPolicy,
  PrivacyPolicyRule,
  Viewer,
  Ent,
  Skip,
  Allow,
} from "@lolopinto/ent";
import { AllowIfEventCreatorRule } from "src/ent/event/privacy/event_creator";

class AllowIfGuestInSameGuestGroupRule implements PrivacyPolicyRule {
  async apply(viewer: Viewer, ent: Ent) {
    if (!viewer.viewerID) {
      return Skip();
    }
    const data = await Guest.loadRawData(viewer.viewerID);
    if (data && data.guest_group_id == (ent as Guest).guestGroupID) {
      return Allow();
    }
    return Skip();
  }
}

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
