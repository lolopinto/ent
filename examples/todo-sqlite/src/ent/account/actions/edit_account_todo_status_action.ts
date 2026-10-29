import { PrivacyPolicy } from "@snowtop/ent";
import { EditAccountTodoStatusActionBase } from "src/ent/generated/account/actions/edit_account_todo_status_action_base";
import type { EditAccountTodoStatusInput } from "src/ent/generated/account/actions/edit_account_todo_status_action_base";
import { AllowIfAccountOrSystemPrivacyPolicy } from "src/privacy/policies";

export type { EditAccountTodoStatusInput };

export class EditAccountTodoStatusAction extends EditAccountTodoStatusActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    // the account itself, or ChangeTodoStatusAction updating the creator's account
    return AllowIfAccountOrSystemPrivacyPolicy;
  }
}
