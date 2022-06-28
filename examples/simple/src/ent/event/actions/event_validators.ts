import { Validator } from "@snowtop/ent/action";
import { EventBuilder, EventInput } from "./generated/event_builder";
import { Event } from "../..";

export class EventTimeValidator implements Validator<Event> {
  validate(builder: EventBuilder, input: EventInput): void {
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
