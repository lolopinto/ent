import { RenameTodoStatusActionBase } from "src/ent/generated/todo/actions/rename_todo_status_action_base";
import type { RenameTodoInput } from "src/ent/generated/todo/actions/rename_todo_status_action_base";
import { AllowIfTodoOwnerPrivacyPolicy } from "src/privacy/policies";

export type { RenameTodoInput };

export class RenameTodoStatusAction extends RenameTodoStatusActionBase {
  getPrivacyPolicy() {
    return AllowIfTodoOwnerPrivacyPolicy;
  }
}
