import {
  EditEventActionBase,
  EventEditInput,
} from "src/ent/event/actions/generated/edit_event_action_base";
import { Validator } from "ent/action";
import { SharedValidators } from "./event_validators";

export { EventEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditEventAction extends EditEventActionBase {
  validators: Validator[] = [...SharedValidators];
}
