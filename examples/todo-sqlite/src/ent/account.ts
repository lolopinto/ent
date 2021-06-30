import {
  AlwaysAllowPrivacyPolicy,
  CustomEdgeQueryBase,
  ID,
  query,
  QueryLoaderFactory,
  RawCountLoaderFactory,
  Viewer,
} from "@snowtop/snowtop-ts";
import { gqlConnection, gqlField } from "@snowtop/snowtop-ts/graphql";
import { AccountBase } from "src/ent/internal";
import { todoLoader } from "./generated/todo_base";
import { Todo } from "./todo";

const openTodosLoader = new QueryLoaderFactory({
  ...Todo.loaderOptions(),
  groupCol: "creator_id",
  clause: query.Eq("completed", false),
  toPrime: [todoLoader],
});

const openTodosCountLoader = new RawCountLoaderFactory({
  ...Todo.loaderOptions(),
  groupCol: "creator_id",
  clause: query.Eq("completed", false),
});

export class AccountToOpenTodosQuery extends CustomEdgeQueryBase<Todo> {
  constructor(viewer: Viewer, src: ID | Account) {
    super(viewer, {
      src,
      // we want to reuse this and not create a new one every time...
      countLoaderFactory: openTodosCountLoader,
      dataLoaderFactory: openTodosLoader,
      options: Todo.loaderOptions(),
    });
  }
}

export class Account extends AccountBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  // showing plural
  @gqlField({ name: "openTodosLegacy", type: "[Todo]" })
  async openTodosLegacy() {
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
