import { UUIDListType } from "@snowtop/ent";
import {
  Action,
  ActionOperation,
  Constraint,
  ConstraintType,
  Field,
  StringType,
  UUIDType,
} from "@snowtop/ent";
import { DeletedAtPattern } from "@snowtop/ent-soft-delete";
import BaseTodoSchema from "src/schema/patterns/base";

export default class Tag extends BaseTodoSchema {
  constructor() {
    super();
    this.addPatterns(new DeletedAtPattern());
  }

  fields: Field[] = [
    StringType({ name: "DisplayName" }),
    StringType({ name: "canonicalName" }).trim().toLowerCase(),
    UUIDType({
      name: "ownerID",
      foreignKey: { schema: "Account", column: "ID" },
    }),
    // contrived field
    UUIDListType({
      name: "relatedTagIds",
      nullable: true,
      fieldEdge: { schema: "Tag" },
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
      fields: ["DisplayName", "ownerID", "relatedTagIds"],
    },
  ];
}
