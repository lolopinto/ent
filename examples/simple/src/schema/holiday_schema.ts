import {
  EntSchemaWithTZ,
  StringType,
  DateType,
  ActionOperation,
} from "@snowtop/ent";
import DayOfWeek from "./patterns/day_of_week";

const HolidaySchema = new EntSchemaWithTZ({
  patterns: [new DayOfWeek()],

  fields: {
    label: StringType(),
    // server default for all holidays is feb 2020 for some reason
    // doing this to test serverDefault
    // date month is 0-index based...
    date: DateType({ serverDefault: new Date(2020, 1, 1) }),
  },

  actions: [
    {
      operation: ActionOperation.Create,
    },
    {
      operation: ActionOperation.Create,
      inputName: "CustomCreateHolidayInput",
      actionName: "CustomCreateHolidayAction",
      graphQLName: "customCreateHoliday",
      // this action exists just to test ID action only field
      actionOnlyFields: [
        {
          type: "ID",
          name: "fake_id",
          nullable: true,
        },
      ],
    },
  ],
});
export default HolidaySchema;
