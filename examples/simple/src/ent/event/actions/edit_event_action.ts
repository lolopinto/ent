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
import { Event } from "../../../ent";
import { ExampleViewer } from "../../../viewer/viewer";

export { EventEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditEventAction extends EditEventActionBase {
  getValidators(): Validator<
    Event,
    EventBuilder<EventEditInput, Event>,
    ExampleViewer,
    EventEditInput,
    Event
  >[] {
    return [...SharedValidators];
  }

  getPrivacyPolicy(): PrivacyPolicy {
    return {
      rules: [new AllowIfViewerIsRule("creatorID"), AlwaysDenyRule],
    };
  }
}
