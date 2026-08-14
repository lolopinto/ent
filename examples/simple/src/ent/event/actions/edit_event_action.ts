import { EditEventActionBase } from "../../generated/event/actions/edit_event_action_base.js";
import type { EventEditInput } from "../../generated/event/actions/edit_event_action_base.js";
import type { Validator } from "@snowtop/ent/action";
import { SharedValidators } from "./event_validators.js";
import { EventBuilder } from "../../generated/event/actions/event_builder.js";
import { Event } from "../../index.js";
import { ExampleViewer } from "../../../viewer/viewer.js";
export type { EventEditInput };
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
}
