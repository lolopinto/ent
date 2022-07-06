import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { DeleteTodoActionBase } from "src/ent/generated/todo/actions/delete_todo_action_base";

export default class DeleteTodoAction extends DeleteTodoActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
