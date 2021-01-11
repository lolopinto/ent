import { AllowIfEntIsVisiblePolicy, PrivacyPolicy } from "@lolopinto/ent";
import { Event, EventActivityBase } from "src/ent/internal";

// we're only writing this once except with --force and packageName provided
export class EventActivity extends EventActivityBase {
  // can view activity if invited to event
  // TODO this will change to only those invited but for now this is fine
  privacyPolicy: PrivacyPolicy = new AllowIfEntIsVisiblePolicy(
    this.eventID,
    Event.loaderOptions(),
  );
}
