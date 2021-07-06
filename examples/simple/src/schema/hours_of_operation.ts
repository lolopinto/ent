import {
  BaseEntSchemaWithTZ,
  Field,
  ActionOperation,
  EnumType,
  TimeType,
  TimetzType,
} from "@snowtop/ent";

export default class HoursOfOperation extends BaseEntSchemaWithTZ {
  fields: Field[] = [
    EnumType({
      name: "dayOfWeek",
      values: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
    }),
    // just to test we have different types
    TimeType({ name: "open" }),
    TimetzType({ name: "close" }),
  ];

  actions = [
    {
      operation: ActionOperation.Create,
    },
  ];
}
