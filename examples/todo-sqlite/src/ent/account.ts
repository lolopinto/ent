import {
  AlwaysAllowPrivacyPolicy,
  CustomEdgeQueryBase,
  ID,
  query,
  QueryLoaderFactory,
  RawCountLoaderFactory,
  Viewer,
} from "@snowtop/ent";
import { gqlConnection, gqlField } from "@snowtop/ent/graphql";
import { AccountBase, todoLoader } from "src/ent/internal";
import { Todo } from "./todo";

// we want to reuse these and not create a new one every time...
// so that the cache is shared
const openTodosLoader = new QueryLoaderFactory({
  ...Todo.loaderOptions(),
  groupCol: "creator_id",
  clause: query.Eq("completed", false),
  toPrime: [todoLoader],
});

const openTodosCountLoader = new RawCountLoaderFactory({
  //  ...Todo.loaderOptions(),
  tableName: Todo.loaderOptions().tableName,
  groupCol: "creator_id",
  clause: query.Eq("completed", false),
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
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  // showing plural
  @gqlField({ name: "openTodosPlural", type: "[Todo]" })
  async openTodosPlural() {
    return await Todo.loadCustom(
      this.viewer,
      query.And(query.Eq("creator_id", this.id), query.Eq("completed", false)),
    );
  }

  // showing connection
  @gqlField({ name: "openTodos", type: gqlConnection("Todo") })
  openTodos() {
    return new AccountToOpenTodosQuery(this.viewer, this);
  }
}
