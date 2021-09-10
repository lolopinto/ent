import {
  EditUserActionBase,
  UserEditInput,
} from "./generated/edit_user_action_base";
import { EditUserPrivacy } from "./edit_user_privacy";

export { UserEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditUserAction extends EditUserActionBase {
  getPrivacyPolicy() {
    return EditUserPrivacy;
  }
}
