import {
  EntSchemaWithTZ,
  StringType,
  DateType,
  ActionOperation,
} from "@snowtop/ent";
import WithDayOfWeek from "./patterns/day_of_week";

const HolidaySchema = new EntSchemaWithTZ({
  patterns: [new WithDayOfWeek()],

  fields: {
    label: StringType(),
    // server default for all holidays is feb 2020 for some reason
    // doing this to test serverDefault
    // date month is 0-index based...
    date: DateType({ serverDefault: new Date(2020, 1, 1) }),
  },

  fieldOverrides: {
    dayOfWeekAlt: {
      nullable: false,
    },
  },

  actions: [
    {
      operation: ActionOperation.Create,
      actionOnlyFields: [
        {
          type: "JSON",
          name: "log",
          optional: true,
        },
      ],
    },
    {
      operation: ActionOperation.Create,
      inputName: "CustomCreateHolidayInput",
      actionName: "CustomCreateHolidayAction",
      hideFromGraphQL: true,
      // this action exists just to test ID action only field
      actionOnlyFields: [
        {
          type: "ID",
          name: "fake_id",
          nullable: true,
        },
      ],
    },
    {
      operation: ActionOperation.Create,
      inputName: "CustomCreateHolidayInput2",
      actionName: "CustomCreateHolidayAction2",
      hideFromGraphQL: true,
      // todo not supported yet
      // __canFailBETA: true,
      // this action exists just to test ID list action only field
      actionOnlyFields: [
        {
          type: "ID",
          name: "fake_ids",
          list: true,
          nullable: true,
        },
      ],
    },
    {
      operation: ActionOperation.Edit,
      inputName: "CustomEditHolidayInput",
      actionName: "CustomEditHolidayAction",
      __canFailBETA: true,
      graphQLName: "holidayCustomEdit",
    },
  ],
});
export default HolidaySchema;
