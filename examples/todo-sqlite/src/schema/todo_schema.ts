import {
  ActionOperation,
  BooleanType,
  StringType,
  TimestampType,
  UUIDType,
} from "@snowtop/ent";
import { TodoBaseEntSchema } from "src/schema/patterns/base";

const TodoSchema = new TodoBaseEntSchema({
  fields: {
    Text: StringType(),
    Completed: BooleanType({
      index: true,
      // serverDEFAULT is complicated on sqlite so use this
      // also this is generally more performant later
      defaultValueOnCreate: () => {
        return false;
      },
    }),
    creatorID: UUIDType({
      foreignKey: { schema: "Account", column: "ID" },
    }),
    completedDate: TimestampType({ index: true, nullable: true }),
  },

  fieldOverrides: {
    createdAt: {
      index: true,
    },
  },

  edges: [
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
  ],

  actions: [
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
  ],
});
export default TodoSchema;
