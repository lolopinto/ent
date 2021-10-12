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
    EnumType({
      name: "dayOfWeekAlt",
      map: {
        Sunday: "sun",
        Monday: "mon",
        Tuesday: "tue",
        Wednesday: "wed",
        Thursday: "thu",
        Friday: "fri",
        Saturday: "sat",
      },
      nullable: true,
    }),
  ];

  actions = [
    {
      operation: ActionOperation.Create,
    },
  ];
}
