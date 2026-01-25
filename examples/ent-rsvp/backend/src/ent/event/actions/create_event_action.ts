import {
  PrivacyPolicy,
  AllowIfViewerHasIdentityPrivacyPolicy,
} from "@snowtop/ent";

import { CreateEventActionBase } from "src/ent/generated/event/actions/create_event_action_base";
import type { EventCreateInput, CreateEventActionTriggers } from "src/ent/generated/event/actions/create_event_action_base";
import CreateEventActivityAction from "src/ent/event_activity/actions/create_event_activity_action";

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
