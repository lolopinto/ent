import {
  Action,
  ActionOperation,
  BaseEntSchema,
  Constraint,
  ConstraintType,
  Field,
  StringType,
  UUIDType,
} from "@snowtop/ent";

export default class Tag extends BaseEntSchema {
  fields: Field[] = [
    StringType({ name: "DisplayName" }),
    StringType({ name: "canonicalName" }).trim().toLowerCase(),
    UUIDType({
      name: "ownerID",
      foreignKey: { schema: "Account", column: "ID" },
    }),
  ];

  constraints: Constraint[] = [
    {
      name: "uniqueForOwner",
      type: ConstraintType.Unique,
      columns: ["canonicalName", "ownerID"],
    },
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      fields: ["DisplayName", "ownerID"],
    },
  ];
}
