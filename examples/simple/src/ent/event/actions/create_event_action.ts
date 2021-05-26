import {
  CreateEventActionBase,
  EventCreateInput,
} from "src/ent/event/actions/generated/create_event_action_base";
import { Trigger, Validator } from "@lolopinto/ent/action";
import { SharedValidators } from "./event_validators";
import { Event } from "src/ent/";
import { EventBuilder } from "./event_builder";
import { AlwaysAllowPrivacyPolicy, PrivacyPolicy } from "@lolopinto/ent";

export { EventCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateEventAction extends CreateEventActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    // TODO can make this better and only do this if viewer is creatorID
    // use AllowIfViewerEqualsRule
    return AlwaysAllowPrivacyPolicy;
  }

  validators: Validator<Event>[] = [...SharedValidators];

  triggers: Trigger<Event>[] = [
    {
      changeset(builder: EventBuilder, input: EventCreateInput) {
        builder.addHostID(input.creatorID);
      },
    },
  ];
}
