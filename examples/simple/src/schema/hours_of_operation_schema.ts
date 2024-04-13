import {
  EntSchemaWithTZ,
  ActionOperation,
  TimeType,
  TimetzType,
} from "@snowtop/ent";
import WithDayOfWeek from "./patterns/day_of_week";

const HoursOfOperationSchema = new EntSchemaWithTZ({
  patterns: [new WithDayOfWeek()],

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
export default HoursOfOperationSchema;
