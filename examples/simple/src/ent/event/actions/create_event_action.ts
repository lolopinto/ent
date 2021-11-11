import {
  CreateEventActionBase,
  EventCreateInput,
} from "./generated/create_event_action_base";
import { Trigger, Validator } from "@snowtop/ent/action";
import { SharedValidators } from "./event_validators";
import { EventBuilder } from "./generated/event_builder";
import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@snowtop/ent";

export { EventCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateEventAction extends CreateEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    // TODO can make this better and only do this if viewer is creatorID
    // use AllowIfViewerEqualsRule
    return AlwaysAllowPrivacyPolicy;
  }

  validators: Validator<EventBuilder, EventCreateInput>[] = [
    ...SharedValidators,
  ];

  triggers: Trigger<EventBuilder, EventCreateInput>[] = [
    {
      changeset(
        builder: EventBuilder<EventCreateInput>,
        input: EventCreateInput,
      ) {
        builder.addHostID(input.creatorID);
      },
    },
  ];
}
