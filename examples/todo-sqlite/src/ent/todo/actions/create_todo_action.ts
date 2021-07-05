import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  CreateTodoActionBase,
  TodoCreateInput,
} from "src/ent/todo/actions/generated/create_todo_action_base";

export { TodoCreateInput };

export default class CreateTodoAction extends CreateTodoActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
