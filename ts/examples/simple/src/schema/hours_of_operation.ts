import {
  BaseEntSchemaWithTZ,
  Field,
  EnumType,
  TimeType,
  TimetzType,
} from "@lolopinto/ent";

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
}
