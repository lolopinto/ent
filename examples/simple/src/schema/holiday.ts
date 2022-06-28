import {
  BaseEntSchemaWithTZ,
  Field,
  StringType,
  DateType,
  ActionOperation,
} from "@snowtop/ent";
import DayOfWeek from "./patterns/day_of_week";

export default class Holiday extends BaseEntSchemaWithTZ {
  constructor() {
    super();
    this.addPatterns(new DayOfWeek());
  }

  fields: Field[] = [StringType({ name: "label" }), DateType({ name: "date" })];

  actions = [
    {
      operation: ActionOperation.Create,
    },
  ];
}
