import {
  EntSchemaWithTZ,
  ActionOperation,
  TimeType,
  TimetzType,
} from "@snowtop/ent";
import DayOfWeek from "./patterns/day_of_week";

const HoursOfOperation = new EntSchemaWithTZ({
  patterns: [new DayOfWeek()],

  fields: {
    // just to test we have different types
    open: TimeType(),
    close: TimetzType(),
  },

  actions: [
    {
      operation: ActionOperation.Create,
    },
  ],
});
export default HoursOfOperation;
