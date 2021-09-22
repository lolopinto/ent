import {
  PrivacyPolicy,
  Ent,
  AllowIfViewerHasIdentityPrivacyPolicy,
} from "@snowtop/ent";
import { Trigger } from "@snowtop/ent/action";

import {
  CreateEventActionBase,
  EventCreateInput,
} from "src/ent/event/actions/generated/create_event_action_base";
import CreateEventActivityAction from "src/ent/event_activity/actions/create_event_activity_action";
import { EventBuilder } from "./generated/event_builder";

export { EventCreateInput };

export default class CreateEventAction extends CreateEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return AllowIfViewerHasIdentityPrivacyPolicy;
  }

  triggers: Trigger<Ent>[] = [
    {
      async changeset(builder: EventBuilder, input: EventCreateInput) {
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
