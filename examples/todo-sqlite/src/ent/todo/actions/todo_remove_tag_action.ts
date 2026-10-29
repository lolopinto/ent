import { TodoRemoveTagActionBase } from "src/ent/generated/todo/actions/todo_remove_tag_action_base";
import { AllowIfTodoOwnerPrivacyPolicy } from "src/privacy/policies";

export class TodoRemoveTagAction extends TodoRemoveTagActionBase {
  getPrivacyPolicy() {
    return AllowIfTodoOwnerPrivacyPolicy;
  }
}
