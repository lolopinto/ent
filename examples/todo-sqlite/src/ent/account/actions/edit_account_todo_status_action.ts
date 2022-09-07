import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { PrivacyPolicy } from "@snowtop/ent";
import {
  EditAccountTodoStatusActionBase,
  EditAccountTodoStatusInput,
} from "src/ent/generated/account/actions/edit_account_todo_status_action_base";

export { EditAccountTodoStatusInput };

export default class EditAccountTodoStatusAction extends EditAccountTodoStatusActionBase {
  getPrivacyPolicy(): PrivacyPolicy {
    return AlwaysAllowPrivacyPolicy;
  }
}
