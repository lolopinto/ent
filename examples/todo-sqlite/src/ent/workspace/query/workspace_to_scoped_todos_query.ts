// TODO fix import for polymorphic queries from pattern.
// This should be from src/ent/internal instead of what it generated from @snowtop/ent

// import { ObjectToScopedTodosEdge } from "@snowtop/ent";
// import { Workspace } from "src/ent/";
import {
  Workspace,
  ObjectToScopedTodosQuery,
  ObjectToScopedTodosEdge,
} from "src/ent/internal";

export class WorkspaceToScopedTodosEdge extends ObjectToScopedTodosEdge {}

export class WorkspaceToScopedTodosQuery extends ObjectToScopedTodosQuery {
  getSourceLoadEntOptions() {
    return Workspace.loaderOptions();
  }
}
