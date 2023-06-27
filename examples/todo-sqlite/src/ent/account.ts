import {
  AlwaysAllowPrivacyPolicy,
  CustomEdgeQueryBase,
  ID,
  query,
  Viewer,
  PrivacyPolicy,
} from "@snowtop/ent";
import { gqlConnection, gqlField } from "@snowtop/ent/graphql";
import { AccountBase, Todo } from "src/ent/internal";

export class Account extends AccountBase {
  getPrivacyPolicy(): PrivacyPolicy<this> {
    return AlwaysAllowPrivacyPolicy;
  }

  // showing plural
  @gqlField({
    class: "Account",
    name: "open_todos_plural",
    type: "[Todo]",
    async: true,
  })
  async openTodosPlural() {
    return Todo.loadCustom(
      this.viewer,
      query.And(query.Eq("assignee_id", this.id), query.Eq("completed", false)),
    );
  }

  // showing connection
  @gqlField({
    class: "Account",
    name: "open_todos",
    type: gqlConnection("Todo"),
  })
  openTodos() {
    return new AccountToOpenTodosQuery(this.viewer, this);
  }

  getDeletedAt() {
    return this.deletedAt;
  }
}

export class AccountToOpenTodosQuery extends CustomEdgeQueryBase<
  Account,
  Todo
> {
  constructor(viewer: Viewer, src: ID | Account) {
    super(viewer, {
      src,
      groupCol: "assignee_id",
      loadEntOptions: Todo.loaderOptions(),
      clause: query.Eq("completed", false),
      name: "account_to_open_todos",
      orderby: [
        {
          column: "created_at",
          direction: "DESC",
        },
      ],
    });
  }
  sourceEnt(id: ID) {
    return Account.load(this.viewer, id);
  }
}
