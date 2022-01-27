import {
  BaseEntSchemaWithTZ,
  Field,
  ActionOperation,
  TimeType,
  TimetzType,
} from "@snowtop/ent";
import DayOfWeek from "./patterns/day_of_week";

export default class HoursOfOperation extends BaseEntSchemaWithTZ {
  constructor() {
    super();
    this.addPatterns(new DayOfWeek());
  }

  fields: Field[] = [
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
