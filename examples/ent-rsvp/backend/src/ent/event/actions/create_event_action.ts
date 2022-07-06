import {
  PrivacyPolicy,
  Ent,
  AllowIfViewerHasIdentityPrivacyPolicy,
  Viewer,
} from "@snowtop/ent";
import { Trigger } from "@snowtop/ent/action";

import {
  CreateEventActionBase,
  EventCreateInput,
  CreateEventActionTriggers,
} from "src/ent/generated/event/actions/create_event_action_base";
import CreateEventActivityAction from "src/ent/event_activity/actions/create_event_activity_action";
import { EventBuilder } from "../../generated/event/actions/event_builder";

export { EventCreateInput };

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

          return await Promise.all(
            input.activities.map(async (activity) => {
              return CreateEventActivityAction.create(builder.viewer, {
                eventID: builder,
                ...activity,
              }).changeset();
            }),
          );
        },
      },
    ];
  }
}
