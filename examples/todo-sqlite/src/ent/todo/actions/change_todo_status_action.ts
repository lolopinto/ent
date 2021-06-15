import { AlwaysAllowPrivacyPolicy } from "@lolopinto/ent";
import {
  ChangeTodoStatusActionBase,
  ChangeTodoStatusInput,
} from "src/ent/todo/actions/generated/change_todo_status_action_base";
export { ChangeTodoStatusInput };

export default class ChangeTodoStatusAction extends ChangeTodoStatusActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
