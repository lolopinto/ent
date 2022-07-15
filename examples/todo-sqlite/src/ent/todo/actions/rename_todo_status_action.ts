import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  RenameTodoInput,
  RenameTodoStatusActionBase,
} from "src/ent/generated/todo/actions/rename_todo_status_action_base";

export { RenameTodoInput };

export default class RenameTodoStatusAction extends RenameTodoStatusActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
