import { TodoAddTagActionBase } from "src/ent/generated/todo/actions/todo_add_tag_action_base";
import { AllowIfTodoOwnerPrivacyPolicy } from "src/privacy/policies";

export class TodoAddTagAction extends TodoAddTagActionBase {
  getPrivacyPolicy() {
    return AllowIfTodoOwnerPrivacyPolicy;
  }
}
