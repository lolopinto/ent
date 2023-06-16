// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AssocEdgeCountLoaderFactory,
  AssocEdgeLoaderFactory,
  AssocEdgeQueryBase,
  EdgeQuerySource,
  ID,
  Viewer,
} from "@snowtop/ent";
import { EdgeType } from "src/ent/generated/types";
import {
  Account,
  AccountToClosedTodosDupQuery,
  AccountToCreatedWorkspacesQuery,
  AccountToOpenTodosDupQuery,
  AccountToScopedTodosQuery,
  AccountToWorkspacesQuery,
  Workspace,
  WorkspaceToMembersEdge,
} from "src/ent/internal";

export const workspaceToMembersCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.WorkspaceToMembers);
export const workspaceToMembersDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.WorkspaceToMembers,
  () => WorkspaceToMembersEdge,
);

export abstract class WorkspaceToMembersQueryBase extends AssocEdgeQueryBase<
  Workspace,
  Account,
  WorkspaceToMembersEdge,
  Viewer
> {
  constructor(
    viewer: Viewer,
    src: EdgeQuerySource<Workspace, Account, Viewer>,
  ) {
    super(
      viewer,
      src,
      workspaceToMembersCountLoaderFactory,
      workspaceToMembersDataLoaderFactory,
      Account.loaderOptions(),
    );
  }

  static query<T extends WorkspaceToMembersQueryBase>(
    this: new (
      viewer: Viewer,
      src: EdgeQuerySource<Workspace, Account>,
    ) => T,
    viewer: Viewer,
    src: EdgeQuerySource<Workspace, Account>,
  ): T {
    return new this(viewer, src);
  }

  withoutTransformations(): this {
    this.configureEdgeQueryableDataOptions({ disableTransformations: true });
    return this;
  }

  sourceEnt(id: ID) {
    return Workspace.load(this.viewer, id);
  }

  queryClosedTodosDup(): AccountToClosedTodosDupQuery {
    return AccountToClosedTodosDupQuery.query(this.viewer, this);
  }

  queryCreatedWorkspaces(): AccountToCreatedWorkspacesQuery {
    return AccountToCreatedWorkspacesQuery.query(this.viewer, this);
  }

  queryOpenTodosDup(): AccountToOpenTodosDupQuery {
    return AccountToOpenTodosDupQuery.query(this.viewer, this);
  }

  queryScopedTodos(): AccountToScopedTodosQuery {
    return AccountToScopedTodosQuery.query(this.viewer, this);
  }

  queryWorkspaces(): AccountToWorkspacesQuery {
    return AccountToWorkspacesQuery.query(this.viewer, this);
  }
}
