// Generated by github.com/lolopinto/ent/ent, DO NOT EDIT.

import {
  AssocEdgeCountLoaderFactory,
  AssocEdgeLoaderFactory,
  AssocEdgeQueryBase,
  CustomEdgeQueryBase,
  EdgeQuerySource,
  ID,
  Viewer,
} from "@snowtop/ent";
import { EdgeType } from "src/ent/generated/types";
import {
  Account,
  AccountToClosedTodosDupEdge,
  AccountToCreatedWorkspacesEdge,
  AccountToOpenTodosDupEdge,
  AccountToWorkspacesEdge,
  Tag,
  Todo,
  TodoToTagsQuery,
  TodoToTodoScopeQuery,
  Workspace,
  WorkspaceToMembersQuery,
  WorkspaceToScopedTodosQuery,
} from "src/ent/internal";

export const accountToClosedTodosDupCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.AccountToClosedTodosDup);
export const accountToClosedTodosDupDataLoaderFactory =
  new AssocEdgeLoaderFactory(
    EdgeType.AccountToClosedTodosDup,
    () => AccountToClosedTodosDupEdge,
  );

export const accountToCreatedWorkspacesCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.AccountToCreatedWorkspaces);
export const accountToCreatedWorkspacesDataLoaderFactory =
  new AssocEdgeLoaderFactory(
    EdgeType.AccountToCreatedWorkspaces,
    () => AccountToCreatedWorkspacesEdge,
  );

export const accountToOpenTodosDupCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.AccountToOpenTodosDup);
export const accountToOpenTodosDupDataLoaderFactory =
  new AssocEdgeLoaderFactory(
    EdgeType.AccountToOpenTodosDup,
    () => AccountToOpenTodosDupEdge,
  );

export const accountToWorkspacesCountLoaderFactory =
  new AssocEdgeCountLoaderFactory(EdgeType.AccountToWorkspaces);
export const accountToWorkspacesDataLoaderFactory = new AssocEdgeLoaderFactory(
  EdgeType.AccountToWorkspaces,
  () => AccountToWorkspacesEdge,
);

export abstract class AccountToClosedTodosDupQueryBase extends AssocEdgeQueryBase<
  Account,
  Todo,
  AccountToClosedTodosDupEdge,
  Viewer
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Account, Todo, Viewer>) {
    super(
      viewer,
      src,
      accountToClosedTodosDupCountLoaderFactory,
      accountToClosedTodosDupDataLoaderFactory,
      Todo.loaderOptions(),
    );
  }

  static query<T extends AccountToClosedTodosDupQueryBase>(
    this: new (
      viewer: Viewer,
      src: EdgeQuerySource<Account, Todo>,
    ) => T,
    viewer: Viewer,
    src: EdgeQuerySource<Account, Todo>,
  ): T {
    return new this(viewer, src);
  }

  sourceEnt(id: ID) {
    return Account.load(this.viewer, id);
  }

  queryTags(): TodoToTagsQuery {
    return TodoToTagsQuery.query(this.viewer, this);
  }

  queryTodoScope(): TodoToTodoScopeQuery {
    return TodoToTodoScopeQuery.query(this.viewer, this);
  }
}

export abstract class AccountToCreatedWorkspacesQueryBase extends AssocEdgeQueryBase<
  Account,
  Workspace,
  AccountToCreatedWorkspacesEdge,
  Viewer
> {
  constructor(
    viewer: Viewer,
    src: EdgeQuerySource<Account, Workspace, Viewer>,
  ) {
    super(
      viewer,
      src,
      accountToCreatedWorkspacesCountLoaderFactory,
      accountToCreatedWorkspacesDataLoaderFactory,
      Workspace.loaderOptions(),
    );
  }

  static query<T extends AccountToCreatedWorkspacesQueryBase>(
    this: new (
      viewer: Viewer,
      src: EdgeQuerySource<Account, Workspace>,
    ) => T,
    viewer: Viewer,
    src: EdgeQuerySource<Account, Workspace>,
  ): T {
    return new this(viewer, src);
  }

  sourceEnt(id: ID) {
    return Account.load(this.viewer, id);
  }

  queryMembers(): WorkspaceToMembersQuery {
    return WorkspaceToMembersQuery.query(this.viewer, this);
  }

  queryScopedTodos(): WorkspaceToScopedTodosQuery {
    return WorkspaceToScopedTodosQuery.query(this.viewer, this);
  }
}

export abstract class AccountToOpenTodosDupQueryBase extends AssocEdgeQueryBase<
  Account,
  Todo,
  AccountToOpenTodosDupEdge,
  Viewer
> {
  constructor(viewer: Viewer, src: EdgeQuerySource<Account, Todo, Viewer>) {
    super(
      viewer,
      src,
      accountToOpenTodosDupCountLoaderFactory,
      accountToOpenTodosDupDataLoaderFactory,
      Todo.loaderOptions(),
    );
  }

  static query<T extends AccountToOpenTodosDupQueryBase>(
    this: new (
      viewer: Viewer,
      src: EdgeQuerySource<Account, Todo>,
    ) => T,
    viewer: Viewer,
    src: EdgeQuerySource<Account, Todo>,
  ): T {
    return new this(viewer, src);
  }

  sourceEnt(id: ID) {
    return Account.load(this.viewer, id);
  }

  queryTags(): TodoToTagsQuery {
    return TodoToTagsQuery.query(this.viewer, this);
  }

  queryTodoScope(): TodoToTodoScopeQuery {
    return TodoToTodoScopeQuery.query(this.viewer, this);
  }
}

export abstract class AccountToWorkspacesQueryBase extends AssocEdgeQueryBase<
  Account,
  Workspace,
  AccountToWorkspacesEdge,
  Viewer
> {
  constructor(
    viewer: Viewer,
    src: EdgeQuerySource<Account, Workspace, Viewer>,
  ) {
    super(
      viewer,
      src,
      accountToWorkspacesCountLoaderFactory,
      accountToWorkspacesDataLoaderFactory,
      Workspace.loaderOptions(),
    );
  }

  static query<T extends AccountToWorkspacesQueryBase>(
    this: new (
      viewer: Viewer,
      src: EdgeQuerySource<Account, Workspace>,
    ) => T,
    viewer: Viewer,
    src: EdgeQuerySource<Account, Workspace>,
  ): T {
    return new this(viewer, src);
  }

  sourceEnt(id: ID) {
    return Account.load(this.viewer, id);
  }

  queryMembers(): WorkspaceToMembersQuery {
    return WorkspaceToMembersQuery.query(this.viewer, this);
  }

  queryScopedTodos(): WorkspaceToScopedTodosQuery {
    return WorkspaceToScopedTodosQuery.query(this.viewer, this);
  }
}

export class AccountToTagsQueryBase<
  TEnt extends Account = Account,
> extends CustomEdgeQueryBase<TEnt, Tag, Viewer> {
  constructor(viewer: Viewer, src: TEnt | ID, sortColumn?: string) {
    super(viewer, {
      src: src,
      groupCol: "owner_id",
      loadEntOptions: Tag.loaderOptions(),
      name: "AccountToTagsQuery",
      sortColumn,
    });
  }

  static query<
    T extends AccountToTagsQueryBase,
    TEnt extends Account = Account,
  >(
    this: new (
      viewer: Viewer,
      src: TEnt | ID,
    ) => T,
    viewer: Viewer,
    src: TEnt | ID,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(id: ID) {
    return Account.load(this.viewer, id);
  }
}

export class AccountToTodosQueryBase<
  TEnt extends Account = Account,
> extends CustomEdgeQueryBase<TEnt, Todo, Viewer> {
  constructor(viewer: Viewer, src: TEnt | ID, sortColumn?: string) {
    super(viewer, {
      src: src,
      groupCol: "creator_id",
      loadEntOptions: Todo.loaderOptions(),
      name: "AccountToTodosQuery",
      sortColumn,
    });
  }

  static query<
    T extends AccountToTodosQueryBase,
    TEnt extends Account = Account,
  >(
    this: new (
      viewer: Viewer,
      src: TEnt | ID,
    ) => T,
    viewer: Viewer,
    src: TEnt | ID,
  ): T {
    return new this(viewer, src);
  }

  async sourceEnt(id: ID) {
    return Account.load(this.viewer, id);
  }
}
