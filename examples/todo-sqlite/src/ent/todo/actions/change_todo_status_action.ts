import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { access } from "fs";
import AccountTransferCreditsAction from "src/ent/account/actions/account_transfer_credits_action";
import EditAccountTodoStatusAction from "src/ent/account/actions/edit_account_todo_status_action";
import { AccountTodoStatusInput } from "src/ent/generated/account/actions/edit_account_todo_status_action_base";
import {
  ChangeTodoStatusActionBase,
  ChangeTodoStatusActionTriggers,
  ChangeTodoStatusInput,
} from "src/ent/generated/todo/actions/change_todo_status_action_base";
export { ChangeTodoStatusInput };

export default class ChangeTodoStatusAction extends ChangeTodoStatusActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  getTriggers(): ChangeTodoStatusActionTriggers {
    return [
      {
        // anytime we complete a todo, we also set the status to test that flow
        async changeset(builder, input) {
          if (input.completed) {
            builder.updateInput({
              completedDate: new Date(),
            });
          } else {
            builder.updateInput({
              completedDate: null,
            });
          }
          const account = await builder.existingEnt.loadCreatorX();
          const status = input.completed
            ? AccountTodoStatusInput.ClosedTodosDup
            : AccountTodoStatusInput.OpenTodosDup;
          //this only exists for testing the flow, not called directly
          return EditAccountTodoStatusAction.create(builder.viewer, account, {
            todoStatus: status,
            todoID: builder.existingEnt.id,
          }).changeset();
        },
      },
      {
        async changeset(builder, input) {
          if (!builder.existingEnt.bounty) {
            return;
          }
          const creator = await builder.existingEnt.loadCreatorX();

          // transfer bounty amount from creator to assignee
          return AccountTransferCreditsAction.create(builder.viewer, creator, {
            to: builder.existingEnt.assigneeID,
            amount: builder.existingEnt.bounty,
          }).changeset();
        },
      },
    ];
  }
}
