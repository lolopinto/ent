import {
  EditEventActionBase, 
  EventEditInput, 
} from "../../generated/event/actions/edit_event_action_base";
import { Validator } from "@snowtop/ent/action";
import { SharedValidators } from "./event_validators";
import {
  AllowIfViewerIsRule,
  AlwaysDenyRule,
  PrivacyPolicy,
} from "@snowtop/ent";
import { EventBuilder } from "../../generated/event/actions/event_builder";

export { EventEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditEventAction extends EditEventActionBase {
  validators: Validator<EventBuilder, EventEditInput>[] = [...SharedValidators];

  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [new AllowIfViewerIsRule("creatorID"), AlwaysDenyRule],
    };
  }
}
