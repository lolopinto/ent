import {
  ID,
  AllowIfEntIsVisiblePolicy,
  Viewer,
  Ent,
  PrivacyPolicyRule,
  Skip,
  Allow,
  AlwaysDenyRule,
} from "@lolopinto/ent";
import { Builder } from "@lolopinto/ent/action";
import {
  CreateEventActivityActionBase,
  EventActivityCreateInput,
} from "src/ent/event_activity/actions/generated/create_event_activity_action_base";
import { Event } from "src/ent/internal";

export { EventActivityCreateInput };

class AllowIfEventCreatorRule implements PrivacyPolicyRule {
  constructor(private id: ID | Builder<Ent>) {}

  async apply(viewer: Viewer, _ent: Ent) {
    if (typeof this.id === "object") {
      return Skip();
    }
    const ent = await Event.load(viewer, this.id);
    if (!ent) {
      return Skip();
    }
    if (ent.creatorID === viewer.viewerID) {
      return Allow();
    }
    return Skip();
  }
}

// we're only writing this once except with --force and packageName provided
export default class CreateEventActivityAction extends CreateEventActivityActionBase {
  getPrivacyPolicy() {
    // only creator of event can create activity
    return {
      rules: [new AllowIfEventCreatorRule(this.input.eventID), AlwaysDenyRule],
    };
  }
}
