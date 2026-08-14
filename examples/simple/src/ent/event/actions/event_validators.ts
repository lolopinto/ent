import type { Validator } from "@snowtop/ent/action";
import {
  EventBuilder,
  EventInput,
} from "../../generated/event/actions/event_builder.js";
import { Event } from "../../index.js";
import { ExampleViewer } from "../../../viewer/viewer.js";

export class EventTimeValidator
  implements Validator<Event, EventBuilder, ExampleViewer, EventInput>
{
  validate(builder: EventBuilder): void {
    const startTime = builder.getNewStartTimeValue();
    const endTime = builder.getNewEndTimeValue();

    if (!startTime) {
      throw new Error("startTime required");
    }

    if (!endTime) {
      // nothing to do here
      return;
    }

    if (startTime.getTime() > endTime.getTime()) {
      throw new Error("start time cannot be after end time");
    }
  }
}

export const SharedValidators = [new EventTimeValidator()];
