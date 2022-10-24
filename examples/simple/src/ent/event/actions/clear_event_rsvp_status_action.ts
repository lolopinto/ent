/**
 * Copyright whaa whaa
 */

import { clearEdgeTypeInGroup } from "@snowtop/ent/action/action";
import {
  ClearEventRsvpStatusActionBase,
  ClearEventRsvpStatusActionTriggers,
  ClearEventRsvpStatusInput,
} from "../../generated/event/actions/clear_event_rsvp_status_action_base";

export { ClearEventRsvpStatusInput };

export default class ClearEventRsvpStatusAction extends ClearEventRsvpStatusActionBase {
  getTriggers(): ClearEventRsvpStatusActionTriggers {
    return [
      {
        async changeset(builder, input) {
          await clearEdgeTypeInGroup(
            builder.orchestrator,
            builder.existingEnt.id,
            input.userID,
            builder.existingEnt.getEventRsvpStatusMap(),
          );
        },
      },
    ];
  }
}
