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
    // TODO remove foreignKey here?? https://github.com/lolopinto/ent/issues/1185
    creatorID: UUIDType({
      foreignKey: { schema: "Account", column: "ID" },
    }),
    completedDate: TimestampType({ index: true, nullable: true }),
    // moving away from creatorID to assigneeID to indicate who the todo is assigned to
    assigneeID: UUIDType({ index: true, fieldEdge: { schema: "Account" } }),
    scopeID: UUIDType({
      // index: true,
      polymorphic: {
        // a todo can be created in a personal account or as part of a workspace/team situation
        types: ["Account", "Workspace"],
      },
      // fieldEdge: {
      //   inverseEdge: "Foo",
      //   // schema: "Account",
      // },
    }),
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
      excludedFields: ["Completed", "completedDate"],
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
