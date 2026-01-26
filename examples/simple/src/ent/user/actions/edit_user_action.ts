import { EditUserActionBase } from "../../generated/user/actions/edit_user_action_base";
import type { UserEditInput } from "../../generated/user/actions/edit_user_action_base";
import { EditUserPrivacy } from "./edit_user_privacy";
export type { UserEditInput };
// we're only writing this once except with --force and packageName provided
export default class EditUserAction extends EditUserActionBase {
  getPrivacyPolicy() {
    return EditUserPrivacy;
  }
}
