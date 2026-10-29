import {
  ID,
  RequestContext,
  applyPrivacyPolicyX,
  AllowIfViewerPrivacyPolicy,
} from "@snowtop/ent";
import { gqlMutation, gqlContextType } from "@snowtop/ent/graphql";
import { Account, AccountToTodosQuery } from "src/ent";
import { BaseAction } from "@snowtop/ent/action/experimental_action";
import { AccountBuilder } from "src/ent/generated/account/actions/account_builder";
import { ChangeTodoStatusAction } from "src/ent/todo/actions/change_todo_status_action";
import { GraphQLBoolean, GraphQLID } from "graphql";
import { DeleteTodoAction } from "src/ent/todo/actions/delete_todo_action";

export class TodosResolver {
  @gqlMutation({
    class: "TodosResolver",
    name: "markAllTodosAs",
    type: "Account",
    args: [
      gqlContextType(),
      {
        name: "accountID",
        type: GraphQLID,
      },
      {
        name: "completed",
        type: GraphQLBoolean,
      },
    ],
    async: true,
  })
  async markAllTodos(
    context: RequestContext,
    accountID: ID,
    completed: boolean,
  ) {
    const vc = context.getViewer();

    const account = await Account.loadX(vc, accountID);
    await applyPrivacyPolicyX(vc, AllowIfViewerPrivacyPolicy, account);
    const todos = await AccountToTodosQuery.query(vc, accountID).queryEnts();
    const bulk = BaseAction.bulkAction(
      account,
      AccountBuilder,
      ...todos.map((todo) =>
        ChangeTodoStatusAction.create(vc, todo, { completed: completed }),
      ),
    );
    return bulk.saveX();
  }

  @gqlMutation({
    class: "TodosResolver",
    name: "removeCompletedTodos",
    type: "Account",
    args: [
      gqlContextType(),
      {
        name: "accountID",
        type: GraphQLID,
      },
    ],
    async: true,
  })
  async removeCompletedTodos(context: RequestContext, accountID: ID) {
    const vc = context.getViewer();

    const account = await Account.loadX(vc, accountID);
    await applyPrivacyPolicyX(vc, AllowIfViewerPrivacyPolicy, account);
    const todos = await AccountToTodosQuery.query(vc, accountID).queryEnts();
    const completedTodos = todos.filter((todo) => todo.completed);

    const bulk = BaseAction.bulkAction(
      account,
      AccountBuilder,
      ...completedTodos.map((todo) => DeleteTodoAction.create(vc, todo)),
    );
    return bulk.saveX();
  }
}
