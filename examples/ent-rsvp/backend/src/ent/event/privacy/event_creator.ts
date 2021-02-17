import {
  ID,
  Viewer,
  Ent,
  PrivacyPolicyRule,
  Skip,
  Allow,
  AlwaysDenyRule,
  Deny,
} from "@lolopinto/ent";
import { Builder } from "@lolopinto/ent/action";
import { Event } from "src/ent/internal";

export class AllowIfEventCreatorRule implements PrivacyPolicyRule {
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
  constructor(private id: ID | Builder<Ent>) {}
  rules = [new AllowIfEventCreatorRule(this.id), AlwaysDenyRule];
}
