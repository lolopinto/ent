import { EventActivityRemoveInviteActionBase } from "src/ent/event_activity/actions/generated/event_activity_remove_invite_action_base";
import { AlwaysDenyRule } from "@snowtop/ent";
import { WriteOperation } from "@snowtop/ent/action";
import { EdgeType } from "src/ent/";
import { AllowIfGuestGroupPartOfEventRule } from "src/ent/event_activity/actions/privacy/guest_group_event_rule";
import { DenyIfNotEventCreatorRule } from "src/ent/event/privacy/event_creator";

// we're only writing this once except with --force and packageName provided
export default class EventActivityRemoveInviteAction extends EventActivityRemoveInviteActionBase {
  getPrivacyPolicy() {
    return {
      rules: [
        new DenyIfNotEventCreatorRule(this.builder.existingEnt!.eventID),
        new AllowIfGuestGroupPartOfEventRule(
          this.builder.existingEnt!.eventID,
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
