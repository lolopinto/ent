import {
  CreateEventActionBase,
  EventCreateInput,
} from "src/ent/event/actions/generated/create_event_action_base";
import { Trigger, Validator } from "@lolopinto/ent/action";
import { SharedValidators } from "./event_validators";
import Event from "src/ent/event";
import { EventBuilder } from "./event_builder";

export { EventCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateEventAction extends CreateEventActionBase {
  validators: Validator<Event>[] = [...SharedValidators];

  triggers: Trigger<Event>[] = [
    {
      changeset(builder: EventBuilder) {
        let input = builder.getInput();
        let creator = input.creatorID!;
        builder.addHostID(creator);
      },
    },
  ];
}
