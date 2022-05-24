import { DeleteUserActionBase } from "../../generated/user/actions/delete_user_action_base";
import { EditUserPrivacy } from "./edit_user_privacy";

// we're only writing this once except with --force and packageName provided
export default class DeleteUserAction extends DeleteUserActionBase {
  getPrivacyPolicy() {
    return EditUserPrivacy;
  }
}
