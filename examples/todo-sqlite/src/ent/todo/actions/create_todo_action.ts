import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  CreateTodoActionBase,
  TodoCreateInput,
} from "src/ent/generated/todo/actions/create_todo_action_base";

export { TodoCreateInput };

export default class CreateTodoAction extends CreateTodoActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
