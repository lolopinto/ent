import { AccountTransferCreditsAction } from "src/ent/account/actions/account_transfer_credits_action";
import { EditAccountTodoStatusAction } from "src/ent/account/actions/edit_account_todo_status_action";
import { AccountTodoStatusInput } from "src/ent/generated/account/actions/edit_account_todo_status_action_base";
import { ChangeTodoStatusActionBase } from "src/ent/generated/todo/actions/change_todo_status_action_base";
import type { ChangeTodoStatusActionTriggers, ChangeTodoStatusInput } from "src/ent/generated/todo/actions/change_todo_status_action_base";
import {
  AllowIfTodoOwnerPrivacyPolicy,
  SystemViewer,
} from "src/privacy/policies";

export { AccountTodoStatusInput };
export type { ChangeTodoStatusInput };

export class ChangeTodoStatusAction extends ChangeTodoStatusActionBase {
  getPrivacyPolicy() {
    return AllowIfTodoOwnerPrivacyPolicy;
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
          // the assignee may not be the creator, so update the creator's
          // account on behalf of this already-authorized action
          return EditAccountTodoStatusAction.create(
            new SystemViewer(),
            account,
            {
              todoStatus: status,
              todoId: builder.existingEnt.id,
            },
          ).changeset();
        },
      },
      {
        async changeset(builder, input) {
          const todo = builder.existingEnt;
          // only pay out when the todo goes from open to completed
          if (!todo.bounty || !input.completed || todo.completed) {
            return;
          }
          const creator = await todo.loadCreatorX();

          // the bounty is paid out once
          builder.updateInput({ bounty: null });

          // transfer bounty amount from creator to assignee. the assignee may
          // be the one completing it, so this runs on behalf of this action
          return AccountTransferCreditsAction.create(
            new SystemViewer(),
            creator,
            {
              to: todo.assigneeId,
              amount: todo.bounty,
            },
          ).changeset();
        },
      },
    ];
  }
}
