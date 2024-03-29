// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import { AssocEdgeInputOptions, Ent, ID, Viewer } from "@snowtop/ent";
import { AssocEdgeOptions, Builder, Orchestrator } from "@snowtop/ent/action";
import { EdgeType, NodeType } from "src/ent/generated/types";
import { ITodoContainer, Todo } from "src/ent/internal";

export interface ITodoContainerBuilder<T extends ITodoContainer> {
  addScopedTodo(...nodes: (ID | Todo | Builder<Todo, any>)[]): this;
  addScopedTodoID(
    id: ID | Builder<Todo, any>,
    options?: AssocEdgeInputOptions,
  ): this;
  removeScopedTodo(...nodes: (ID | Todo)[]): this;
}

// come back
type Constructor<T extends ITodoContainer<Viewer> = ITodoContainer<Viewer>> =
  new (
    ...args: any[]
  ) => T;

interface BuilderConstructor<T extends ITodoContainer<Viewer>, C = {}> {
  orchestrator: Orchestrator<T, any, Viewer>;
  isBuilder<T extends Ent>(
    node: ID | T | Builder<T, any>,
  ): node is Builder<T, any>;
}

export type TodoContainerBuilderIsh<T extends ITodoContainer<Viewer>> =
  Constructor<
    // @ts-ignore TODO fix
    BuilderConstructor<T>
  >;

export function TodoContainerBuilder<
  TEnt extends ITodoContainer<Viewer>,
  TBase extends TodoContainerBuilderIsh<TEnt>,
>(BaseClass: TBase) {
  return class TodoContainerBuilder
    extends BaseClass
    implements ITodoContainerBuilder<TEnt>
  {
    constructor(...args: any[]) {
      super(...args);
    }

    addScopedTodo(...nodes: (ID | Todo | Builder<Todo, any>)[]): this {
      for (const node of nodes) {
        if (this.isBuilder(node)) {
          this.addScopedTodoID(node);
        } else if (typeof node === "object") {
          this.addScopedTodoID(node.id);
        } else {
          this.addScopedTodoID(node);
        }
      }
      return this;
    }

    addScopedTodoID(
      id: ID | Builder<Todo, any>,
      options?: AssocEdgeInputOptions,
    ): this {
      this.orchestrator.addOutboundEdge(
        id,
        EdgeType.ObjectToScopedTodos,
        NodeType.Todo,
        options,
      );
      return this;
    }

    removeScopedTodoID(id: ID, opts?: AssocEdgeOptions): this {
      this.orchestrator.removeOutboundEdge(
        id,
        EdgeType.ObjectToScopedTodos,
        opts,
      );
      return this;
    }

    removeScopedTodo(...nodes: (ID | Todo)[]): this {
      for (const node of nodes) {
        if (typeof node === "object") {
          this.orchestrator.removeOutboundEdge(
            node.id,
            EdgeType.ObjectToScopedTodos,
          );
        } else {
          this.orchestrator.removeOutboundEdge(
            node,
            EdgeType.ObjectToScopedTodos,
          );
        }
      }
      return this;
    }
  };
}
