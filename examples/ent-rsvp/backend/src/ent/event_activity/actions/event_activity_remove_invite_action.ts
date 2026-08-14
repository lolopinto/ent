import { EventActivityRemoveInviteActionBase } from "../../generated/event_activity/actions/event_activity_remove_invite_action_base.js";
import { AlwaysDenyRule } from "@snowtop/ent";
import { WriteOperation } from "@snowtop/ent/action";
import { EdgeType } from "../../generated/types.js";
import { AllowIfGuestGroupPartOfEventRule } from "./privacy/guest_group_event_rule.js";
import { DenyIfNotEventCreatorRule } from "../../event/privacy/event_creator.js";

// we're only writing this once except with --force and packageName provided
export default class EventActivityRemoveInviteAction extends EventActivityRemoveInviteActionBase {
  getPrivacyPolicy() {
    return {
      rules: [
        new DenyIfNotEventCreatorRule(this.builder.existingEnt!.eventId),
        new AllowIfGuestGroupPartOfEventRule(
          this.builder.existingEnt!.eventId,
          this.builder.getEdgeInputData(
            EdgeType.EventActivityToInvites,
            WriteOperation.Delete,
          ),
        ),
        AlwaysDenyRule,
      ],
    };
  }
}
