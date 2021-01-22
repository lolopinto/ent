import { AlwaysDenyRule } from "@lolopinto/ent";
import {
  DenyIfEdgeDoesNotExistRule,
  DelayedResultRule,
  DenyIfLoggedOutRule,
} from "@lolopinto/ent/core/privacy";
import { Guest } from "src/ent";
import { EdgeType } from "src/ent/const";
import {
  EditEventActivityRsvpStatusActionBase,
  EditEventActivityRsvpStatusInput,
  EventActivityRsvpStatusInput,
  getEventActivityRsvpStatusInputValues,
} from "src/ent/event_activity/actions/generated/edit_event_activity_rsvp_status_action_base";
import { AllowIfGuestInSameGuestGroupRule } from "src/ent/guest/privacy/guest_rule_privacy";

export { EditEventActivityRsvpStatusInput };
export { EventActivityRsvpStatusInput };

// we're only writing this once except with --force and packageName provided
export default class EditEventActivityRsvpStatusAction extends EditEventActivityRsvpStatusActionBase {
  getPrivacyPolicy() {
    return {
      rules: [
        DenyIfLoggedOutRule,
        // group guest is a part of needs to be invited
        new DelayedResultRule(async (_v, _ent) => {
          const guest = await Guest.loadX(
            this.builder.viewer,
            this.input.guestID,
          );
          return new DenyIfEdgeDoesNotExistRule(
            this.builder.existingEnt!.id,
            guest.guestGroupID,
            EdgeType.EventActivityToInvites,
          );
        }),

        new AllowIfGuestInSameGuestGroupRule(this.input.guestID),
        AlwaysDenyRule,
      ],
    };
  }
}
