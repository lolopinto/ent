import { ID, IDViewer } from "@snowtop/ent";
import { gqlArg, gqlMutation } from "@snowtop/ent/graphql";
import { Account, AccountToTodosQuery, Todo } from "src/ent";
import { BaseAction } from "@snowtop/ent/action/experimental_action";
import { AccountBuilder } from "src/ent/account/actions/generated/account_builder";
import ChangeTodoStatusAction from "src/ent/todo/actions/change_todo_status_action";
import { GraphQLID } from "graphql";
import DeleteTodoAction from "src/ent/todo/actions/delete_todo_action";

export class TodosResolver {
  @gqlMutation({ name: "todosMarkAllAs", type: Account })
  async markAllTodos(
    // we're simplifying, no viewer or anything complicated and anyone can perform the action
    @gqlArg("accountID", { type: GraphQLID }) accountID: ID,
    @gqlArg("completed") completed: boolean,
  ) {
    const vc = new IDViewer(accountID);
    const viewer = vc.viewerID;

    const account = await Account.loadX(vc, viewer);
    const todos = await AccountToTodosQuery.query(vc, viewer).queryEnts();
    const bulk = BaseAction.bulkAction(
      account,
      AccountBuilder,
      ...todos.map((todo) =>
        ChangeTodoStatusAction.create(vc, todo, { completed: completed }),
      ),
    );
    return await bulk.saveX();
  }

  @gqlMutation({ name: "todosRemoveCompleted", type: Account })
  async removeCompletedTodos(
    // we're simplifying, no viewer or anything complicated and anyone can perform the action
    @gqlArg("accountID", { type: GraphQLID }) accountID: ID,
  ) {
    const vc = new IDViewer(accountID);
    const viewer = vc.viewerID;

    const account = await Account.loadX(vc, viewer);
    const todos = await AccountToTodosQuery.query(vc, viewer).queryEnts();
    const completedTodos = todos.filter((todo) => todo.completed);

    const bulk = BaseAction.bulkAction(
      account,
      AccountBuilder,
      ...completedTodos.map((todo) => DeleteTodoAction.create(vc, todo)),
    );
    return await bulk.saveX();
  }
}
