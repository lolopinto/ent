import { AllowIfViewerEqualsRule, AlwaysDenyRule, Viewer } from "@snowtop/ent";
import type { AddressCreateInput } from "src/ent/generated/address/actions/create_address_action_base";
import { EventActivityBuilder } from "src/ent/generated/event_activity/actions/event_activity_builder";
import { UserBuilder } from "src/ent/generated/user/actions/user_builder";
import {
  AllowIfEventCreatorRule,
  AllowIfEventCreatorFromActivityRule,
} from "src/ent/event/privacy/event_creator";
import { NodeType } from "src/ent/generated/const";

export function addressOwnerPrivacy(
  viewer: Viewer,
  owner: AddressCreateInput["ownerId"],
  ownerType: string,
) {
  if (typeof owner === "object") {
    // Nested creation is allowed only for the matching owner type and caller.
    if (owner.viewer.viewerID !== viewer.viewerID || !viewer.viewerID) {
      return { rules: [AlwaysDenyRule] };
    }
    if (
      ownerType === NodeType.EventActivity &&
      owner instanceof EventActivityBuilder
    ) {
      const input = owner.getInput();
      return {
        rules: [
          new AllowIfEventCreatorRule(owner.getNewEventIdValue(), input),
          AlwaysDenyRule,
        ],
      };
    }
    if (ownerType === NodeType.User && owner instanceof UserBuilder) {
      return {
        rules: [
          new AllowIfViewerEqualsRule(
            owner.existingEnt?.id ?? owner.placeholderID,
          ),
          AlwaysDenyRule,
        ],
      };
    }
    return { rules: [AlwaysDenyRule] };
  }
  const rule =
    ownerType === NodeType.EventActivity
      ? new AllowIfEventCreatorFromActivityRule(owner)
      : ownerType === NodeType.User
        ? new AllowIfViewerEqualsRule(owner)
        : AlwaysDenyRule;
  return { rules: [rule, AlwaysDenyRule] };
}
