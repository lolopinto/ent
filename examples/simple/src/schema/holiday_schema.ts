import {
  EntSchemaWithTZ,
  StringType,
  DateType,
  ActionOperation,
} from "@snowtop/ent";
import DayOfWeek from "./patterns/day_of_week";

const HolidaySchema = new EntSchemaWithTZ({
  patterns: [new DayOfWeek()],

  fields: { label: StringType(), date: DateType() },

  actions: [
    {
      operation: ActionOperation.Create,
    },
  ],
});
export default HolidaySchema;
