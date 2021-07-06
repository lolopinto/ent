import {
  AllowIfViewerEqualsRule,
  AlwaysDenyRule,
  PrivacyPolicy,
  Ent,
} from "@snowtop/ent";
import { Trigger } from "@snowtop/ent/action";

import {
  CreateEventActionBase,
  EventCreateInput,
} from "src/ent/event/actions/generated/create_event_action_base";
import CreateEventActivityAction from "src/ent/event_activity/actions/create_event_activity_action";
import { EventBuilder } from "./event_builder";

export { EventCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateEventAction extends CreateEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [
        new AllowIfViewerEqualsRule(this.input.creatorID),
        AlwaysDenyRule,
      ],
    };
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
