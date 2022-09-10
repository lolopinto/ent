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
import { Clause } from "@snowtop/ent/core/clause";

// we want to reuse these and not create a new one every time...
// so that the cache is shared
// TODO https://github.com/lolopinto/ent/issues/1048 can we skip getTransformedReadClause
const openTodosLoader = new QueryLoaderFactory({
  ...Todo.loaderOptions(),
  groupCol: "creator_id",
  clause: query.AndOptional(
    query.Eq("completed", false),
    getTransformedReadClause(TodoSchema),
  ),
  toPrime: [todoLoader],
});

// TODO https://github.com/lolopinto/ent/issues/1048 can we skip getTransformedReadClause
const openTodosCountLoader = new RawCountLoaderFactory({
  //  ...Todo.loaderOptions(),

  tableName: Todo.loaderOptions().tableName,
  groupCol: "creator_id",
  clause: query.AndOptional(
    query.Eq("completed", false),
    getTransformedReadClause(TodoSchema),
  ),
});

interface CustomEdgeQueryBaseOpts {
  // main loaderFactory
  loadEntOptions: any;
  groupCol: "creator_id";
  clause: Clause;
  name: string;
  // query-name used to create loaders...
  // and then from there it does what it needs to do to do the right thing...
}

export class AccountToOpenTodosQuery extends CustomEdgeQueryBase<
  Account,
  Todo
> {
  constructor(viewer: Viewer, src: ID | Account) {
    super(viewer, {
      src,
      countLoaderFactory: openTodosCountLoader,
      dataLoaderFactory: openTodosLoader,
      // TODO https://github.com/lolopinto/ent/issues/1048 can we skip getTransformedReadClause
      // have the info here and can use loaderFactory...
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
      query.And(query.Eq("creator_id", this.id), query.Eq("completed", false)),
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
