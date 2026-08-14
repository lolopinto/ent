import {
  PrivacyPolicy,
  AllowIfViewerHasIdentityPrivacyPolicy,
} from "@snowtop/ent";

import { CreateEventActionBase } from "../../generated/event/actions/create_event_action_base.js";
import type {
  EventCreateInput,
  CreateEventActionTriggers,
} from "../../generated/event/actions/create_event_action_base.js";
import CreateEventActivityAction from "../../event_activity/actions/create_event_activity_action.js";

export type { EventCreateInput };

export default class CreateEventAction extends CreateEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  getTriggers(): CreateEventActionTriggers {
    return [
      {
        async changeset(builder, input) {
          if (!input.activities) {
            return;
          }

          return Promise.all(
            input.activities.map(async (activity) => {
              return CreateEventActivityAction.create(builder.viewer, {
                eventId: builder,
                ...activity,
              }).changeset();
            }),
          );
        },
      },
    ];
  }
}
