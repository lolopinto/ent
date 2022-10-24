import { Edge, Pattern } from "@snowtop/ent";

export class TodoContainerPattern implements Pattern {
  name = "todo_container";
  fields = {};
  edges: Edge[] = [
    {
      // TODO only need this as a workaround for
      // https://github.com/lolopinto/ent/issues/503

      // account -> todos
      // workspace -> todos
      name: "scopedTodos",
      schemaName: "Todo",
      inverseEdge: { name: "todoScope" },
    },
  ];
}
