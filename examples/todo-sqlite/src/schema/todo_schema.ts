import {
  ActionOperation,
  BooleanType,
  IntegerType,
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

    assigneeID: UUIDType({
      index: true,
      fieldEdge: {
        schema: "Account",
        indexEdge: {
          name: "todos_assigned",
        },
      },
    }),
    scopeID: UUIDType({
      polymorphic: {
        disableBuilderType: true,
        // a todo can be created in a personal account or as part of a workspace/team situation
        types: ["Account", "Workspace"],
      },
    }),
    // bounty associated with a todo
    // if done, creator_id transfers from their balance to assigneeID
    bounty: IntegerType({
      nullable: true,
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
          __canFailBETA: true,
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
      fields: ["bounty"],
      actionName: "ChangeTodoBountyAction",
      graphQLName: "changeTodoBounty",
      inputName: "ChangeTodoBountyInput",
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
