import {
  EditEventActionBase,
  EventEditInput,
} from "./generated/edit_event_action_base";
import { Validator } from "@snowtop/ent/action";
import { SharedValidators } from "./event_validators";
import { Event } from "../..";
import {
  AllowIfViewerIsRule,
  AlwaysDenyRule,
  PrivacyPolicy,
} from "@snowtop/ent";

export { EventEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditEventAction extends EditEventActionBase {
  validators: Validator<Event>[] = [...SharedValidators];

  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [new AllowIfViewerIsRule("creatorID"), AlwaysDenyRule],
    };
  }
}
