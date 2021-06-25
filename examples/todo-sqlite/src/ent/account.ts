import { AlwaysAllowPrivacyPolicy, query } from "@snowtop/snowtop-ts";
import { gqlField } from "@snowtop/snowtop-ts/graphql";
import { AccountBase } from "src/ent/internal";
import { Todo } from "./todo";

export class Account extends AccountBase {
  privacyPolicy = AlwaysAllowPrivacyPolicy;

  // TODO this should eventually be a connection but we're starting here.
  @gqlField({ name: "openTodosLegacy", type: "[Todo]" })
  async openTodos() {
    return await Todo.loadCustom(
      this.viewer,
      query.And(query.Eq("creator_id", this.id), query.Eq("completed", false)),
    );
  }
}
