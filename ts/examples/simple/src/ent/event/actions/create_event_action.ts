import {
  CreateEventActionBase,
  EventCreateInput,
} from "src/ent/event/actions/generated/create_event_action_base";
import { Trigger, Validator } from "@lolopinto/ent/action";
import { SharedValidators } from "./event_validators";
import { Event } from "src/ent/";
import { EventBuilder } from "./event_builder";

export { EventCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateEventAction extends CreateEventActionBase {
  validators: Validator<Event>[] = [...SharedValidators];

  triggers: Trigger<Event>[] = [
    {
      changeset(builder: EventBuilder, input: EventCreateInput) {
        builder.addHostID(input.creatorID);
      },
    },
  ];
}
