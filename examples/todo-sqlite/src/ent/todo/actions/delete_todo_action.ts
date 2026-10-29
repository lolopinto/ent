import { DeleteTodoActionBase } from "src/ent/generated/todo/actions/delete_todo_action_base";
import { AllowIfTodoCreatorPrivacyPolicy } from "src/privacy/policies";

export class DeleteTodoAction extends DeleteTodoActionBase {
  getPrivacyPolicy() {
    return AllowIfTodoCreatorPrivacyPolicy;
  }
}
