import {
  BaseEntSchemaWithTZ,
  Field,
  StringType,
  DateType,
  ActionOperation,
} from "@snowtop/ent";

export default class Holiday extends BaseEntSchemaWithTZ {
  fields: Field[] = [StringType({ name: "label" }), DateType({ name: "date" })];

  actions = [
    {
      operation: ActionOperation.Create,
    },
  ];
}
