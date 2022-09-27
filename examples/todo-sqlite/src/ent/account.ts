import {
  AlwaysAllowPrivacyPolicy,
  CustomEdgeQueryBase,
  ID,
  query,
  Viewer,
  PrivacyPolicy,
} from "@snowtop/ent";
import { gqlConnection, gqlField } from "@snowtop/ent/graphql";
import { AccountBase } from "src/ent/internal";
import { Todo } from "./todo";

export class AccountToOpenTodosQuery extends CustomEdgeQueryBase<
  Account,
  Todo
> {
  constructor(viewer: Viewer, src: ID | Account) {
    super(viewer, {
      src,
      groupCol: "creator_id",
      loadEntOptions: Todo.loaderOptions(),
      clause: query.Eq("completed", false),
      name: "account_to_open_todos",
      sortColumn: "created_at",
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
