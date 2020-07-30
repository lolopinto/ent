import {
  CreateEventActionBase,
  EventCreateInput,
} from "src/ent/event/actions/generated/create_event_action_base";
import { Validator } from "@lolopinto/ent/action";
import { SharedValidators } from "./event_validators";
import Event from "src/ent/event";

export { EventCreateInput };

// we're only writing this once except with --force and packageName provided
export default class CreateEventAction extends CreateEventActionBase {
  validators: Validator<Event>[] = [...SharedValidators];
}
