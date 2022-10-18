import {
  ObjectToScopedTodosEdge,
  ObjectToScopedTodosQuery,
  Workspace,
} from "src/ent/internal";

export class WorkspaceToScopedTodosEdge extends ObjectToScopedTodosEdge {}

export class WorkspaceToScopedTodosQuery extends ObjectToScopedTodosQuery {
  getSourceLoadEntOptions() {
    return Workspace.loaderOptions();
  }
}
