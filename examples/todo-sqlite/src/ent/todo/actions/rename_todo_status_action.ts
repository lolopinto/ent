import { AlwaysAllowPrivacyPolicy } from "@snowtop/snowtop-ts";
import {
  RenameTodoInput,
  RenameTodoStatusActionBase,
} from "src/ent/todo/actions/generated/rename_todo_status_action_base";

export { RenameTodoInput };

export default class RenameTodoStatusAction extends RenameTodoStatusActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
