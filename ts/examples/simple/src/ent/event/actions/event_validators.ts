import { EventBuilder } from "./event_builder";
import { Validator } from "@lolopinto/ent/action";
import { Event } from "src/ent/";

export class EventTimeValidator implements Validator<Event> {
  validate(builder: EventBuilder): void {
    const startTime = builder.getStartTime();
    const endTime = builder.getEndTime();

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
