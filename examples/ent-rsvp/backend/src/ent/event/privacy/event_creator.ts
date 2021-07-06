import {
  ID,
  Viewer,
  Ent,
  PrivacyPolicyRule,
  Skip,
  Allow,
  AlwaysDenyRule,
  Deny,
  Data,
} from "@snowtop/ent";
import { Builder } from "@snowtop/ent/action";
import { EventActivity } from "src/ent";
import { Event } from "src/ent/internal";

export class AllowIfEventCreatorRule implements PrivacyPolicyRule {
  constructor(private id: ID | Builder<Ent>, private input?: Data) {}

  async apply(viewer: Viewer, _ent: Ent) {
    if (typeof this.id === "object") {
      // if we're creating something with an eventID, allow this
      // e.g. creating an event while creating an activity
      if (this.input && this.input.eventID === this.id) {
        return Allow();
      }

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

export class DenyIfNotEventCreatorRule implements PrivacyPolicyRule {
  constructor(private id: ID | Builder<Ent>) {}

  async apply(viewer: Viewer, _ent: Ent) {
    if (typeof this.id === "object") {
      return Deny();
    }
    const ent = await Event.load(viewer, this.id);
    if (!ent) {
      return Deny();
    }
    if (ent.creatorID === viewer.viewerID) {
      return Skip();
    }
    return Deny();
  }
}

export class AllowIfEventCreatorPrivacyPolicy {
  constructor(private id: ID | Builder<Ent>, private input?: Data) {}
  rules = [new AllowIfEventCreatorRule(this.id, this.input), AlwaysDenyRule];
}

export class AllowIfEventCreatorFromActivityRule implements PrivacyPolicyRule {
  constructor(private id: ID) {}

  async apply(viewer: Viewer, _ent: Ent) {
    const ent = await EventActivity.load(viewer, this.id);
    if (!ent) {
      return Skip();
    }
    const event = await ent.loadEventX();
    if (event.creatorID === viewer.viewerID) {
      return Allow();
    }
    return Skip();
  }
}
