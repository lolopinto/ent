import {
  Action,
  ActionOperation,
  BaseEntSchema,
  BooleanType,
  Field,
  StringType,
  UUIDType,
} from "@lolopinto/ent";

export default class Todo extends BaseEntSchema {
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
      graphQLName: "todoChangeStatus",
      inputName: "ChangeTodoStatusInput",
    },
  ];
}
