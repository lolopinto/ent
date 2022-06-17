import {
  Action,
  ActionOperation,
  BooleanType,
  Edge,
  Field,
  StringType,
  UUIDType,
} from "@snowtop/ent";
import { DeletedAtPattern } from "@snowtop/ent-soft-delete";
import BaseEntTodoSchema from "src/schema/patterns/base";

export default class Todo extends BaseEntTodoSchema {
  constructor() {
    super();
    this.addPatterns(new DeletedAtPattern());
  }

  fields: Field[] = [
    StringType({ name: "Text" }),
    BooleanType({
      name: "Completed",
      index: true,
      // serverDEFAULT is complicated on sqlite so use this
      // also this is generally more performant later
      defaultValueOnCreate: () => {
        return false;
      },
    }),
    UUIDType({
      name: "creatorID",
      foreignKey: { schema: "Account", column: "ID" },
    }),
  ];

  edges: Edge[] = [
    {
      name: "tags",
      schemaName: "Tag",
      inverseEdge: {
        name: "todos",
      },
      edgeActions: [
        {
          operation: ActionOperation.AddEdge,
        },
        {
          operation: ActionOperation.RemoveEdge,
        },
      ],
    },
  ];

  actions: Action[] = [
    {
      operation: ActionOperation.Create,
      // TODO can it know not to make completed required if defaultValueOnCreate is set?
      fields: ["Text", "creatorID"],
    },
    {
      operation: ActionOperation.Edit,
      fields: ["Completed"],
      actionName: "ChangeTodoStatusAction",
      graphQLName: "changeTodoStatus",
      inputName: "ChangeTodoStatusInput",
    },
    {
      operation: ActionOperation.Edit,
      fields: ["Text"],
      actionName: "RenameTodoStatusAction",
      graphQLName: "renameTodo",
      inputName: "RenameTodoInput",
      actionOnlyFields: [
        {
          name: "reason_for_change",
          type: "String",
          nullable: true,
        },
      ],
    },
    {
      operation: ActionOperation.Delete,
    },
  ];
}
