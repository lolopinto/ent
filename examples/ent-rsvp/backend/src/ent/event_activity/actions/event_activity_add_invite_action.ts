import { AlwaysDenyRule } from "@snowtop/ent";
import { WriteOperation } from "@snowtop/ent/action";
import { EventActivityAddInviteActionBase } from "src/ent/generated/event_activity/actions/event_activity_add_invite_action_base";
import { EdgeType } from "src/ent/generated/types";
import { AllowIfGuestGroupPartOfEventRule } from "src/ent/event_activity/actions/privacy/guest_group_event_rule";
import { DenyIfNotEventCreatorRule } from "src/ent/event/privacy/event_creator";

// we're only writing this once except with --force and packageName provided
export default class EventActivityAddInviteAction extends EventActivityAddInviteActionBase {
  getPrivacyPolicy() {
    return {
      rules: [
        new DenyIfNotEventCreatorRule(this.builder.existingEnt!.eventId),
        new AllowIfGuestGroupPartOfEventRule(
          this.builder.existingEnt!.eventId,
          this.builder.getEdgeInputData(
            EdgeType.EventActivityToInvites,
            WriteOperation.Insert,
          ),
        ),
        AlwaysDenyRule,
      ],
    };
  }
}
