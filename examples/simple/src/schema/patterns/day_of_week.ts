import { EnumType, Field, Pattern } from "@snowtop/ent";

// extract into pattern so enum can be shared across multiple schemas
// and confirm that we only create one enum
export default class DayOfWeek implements Pattern {
  name = "enums";
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
}
