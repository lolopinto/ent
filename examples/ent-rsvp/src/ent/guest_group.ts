import { GuestGroupBase } from "src/ent/internal";
import { PrivacyPolicy } from "@lolopinto/ent";
import { AllowIfEventCreatorPrivacyPolicy } from "src/ent/event/privacy/event_creator";

// we're only writing this once except with --force and packageName provided
export class GuestGroup extends GuestGroupBase {
  // can view guest group if creator of event
  privacyPolicy: PrivacyPolicy = new AllowIfEventCreatorPrivacyPolicy(
    this.eventID,
  );
}
