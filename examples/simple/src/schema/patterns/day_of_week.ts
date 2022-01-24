import { EnumType, Field, Pattern } from "@snowtop/ent";

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
