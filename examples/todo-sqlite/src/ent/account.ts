import {
  AlwaysAllowPrivacyPolicy,
  CustomEdgeQueryBase,
  ID,
  query,
  QueryLoaderFactory,
  RawCountLoaderFactory,
  Viewer,
  getTransformedReadClause,
  PrivacyPolicy,
} from "@snowtop/ent";
import { gqlConnection, gqlField } from "@snowtop/ent/graphql";
import { AccountBase, todoLoader } from "src/ent/internal";
import { Todo } from "./todo";
import TodoSchema from "src/schema/todo_schema";

// we want to reuse these and not create a new one every time...
// so that the cache is shared
const openTodosLoader = new QueryLoaderFactory({
  ...Todo.loaderOptions(),
  groupCol: "creator_id",
  clause: query.AndOptional(
    query.Eq("completed", false),
    getTransformedReadClause(TodoSchema),
  ),
  toPrime: [todoLoader],
});

const openTodosCountLoader = new RawCountLoaderFactory({
  //  ...Todo.loaderOptions(),
  tableName: Todo.loaderOptions().tableName,
  groupCol: "creator_id",
  clause: query.AndOptional(
    query.Eq("completed", false),
    getTransformedReadClause(TodoSchema),
  ),
});

export class AccountToOpenTodosQuery extends CustomEdgeQueryBase<
  Account,
  Todo
> {
  constructor(viewer: Viewer, src: ID | Account) {
    super(viewer, {
      src,
      countLoaderFactory: openTodosCountLoader,
      dataLoaderFactory: openTodosLoader,
      options: Todo.loaderOptions(),
    });
  }
  sourceEnt(id: ID) {
    return Account.load(this.viewer, id);
  }
}

export class Account extends AccountBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }

  // showing plural
  @gqlField({ name: "open_todos_plural", type: "[Todo]" })
  async openTodosPlural() {
    return await Todo.loadCustom(
      this.viewer,
      query.AndOptional(
        query.Eq("creator_id", this.id),
        query.Eq("completed", false),
        getTransformedReadClause(TodoSchema),
      ),
    );
  }

  // showing connection
  @gqlField({ name: "open_todos", type: gqlConnection("Todo") })
  openTodos() {
    return new AccountToOpenTodosQuery(this.viewer, this);
  }

  getDeletedAt() {
    return this.deletedAt;
  }
}
