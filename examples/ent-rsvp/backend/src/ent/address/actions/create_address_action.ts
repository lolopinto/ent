import { AllowIfViewerEqualsRule, AlwaysDenyRule } from "@snowtop/ent";
import { CreateAddressActionBase } from "src/ent/generated/address/actions/create_address_action_base";
import type { AddressCreateInput } from "src/ent/generated/address/actions/create_address_action_base";
import { EventActivityBuilder } from "src/ent/generated/event_activity/actions/event_activity_builder";
import { UserBuilder } from "src/ent/generated/user/actions/user_builder";
import {
  AllowIfEventCreatorRule,
  AllowIfEventCreatorFromActivityRule,
} from "src/ent/event/privacy/event_creator";
import { NodeType } from "src/ent/generated/const";

export type { AddressCreateInput };

export default class CreateAddressAction extends CreateAddressActionBase {
  getPrivacyPolicy() {
    const owner = this.input.ownerId;
    if (typeof owner === "object") {
      // Nested creation is allowed only for the matching owner type and caller.
      if (
        owner.viewer.viewerID !== this.viewer.viewerID ||
        !this.viewer.viewerID
      ) {
        return { rules: [AlwaysDenyRule] };
      }
      if (
        this.input.ownerType === NodeType.EventActivity &&
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
      if (
        this.input.ownerType === NodeType.User &&
        owner instanceof UserBuilder
      ) {
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
      this.input.ownerType === NodeType.EventActivity
        ? new AllowIfEventCreatorFromActivityRule(owner)
        : this.input.ownerType === NodeType.User
          ? new AllowIfViewerEqualsRule(owner)
          : AlwaysDenyRule;
    return { rules: [rule, AlwaysDenyRule] };
  }
}
