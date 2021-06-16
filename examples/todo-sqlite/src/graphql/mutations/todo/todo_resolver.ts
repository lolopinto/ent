import { ID, IDViewer } from "@lolopinto/ent";
import { gqlArg, gqlMutation } from "@lolopinto/ent/graphql";
import { Account, AccountToTodosQuery, Todo } from "src/ent";
import { BaseAction } from "@lolopinto/ent/action/experimental_action";
import { AccountBuilder } from "src/ent/account/actions/account_builder";
import ChangeTodoStatusAction from "src/ent/todo/actions/change_todo_status_action";
import { GraphQLID } from "graphql";

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
}
