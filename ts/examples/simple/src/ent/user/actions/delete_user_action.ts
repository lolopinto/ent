import { DeleteUserActionBase } from "src/ent/user/actions/generated/delete_user_action_base";
import { EditUserPrivacy } from "./edit_user_privacy";

// we're only writing this once except with --force and packageName provided
export default class DeleteUserAction extends DeleteUserActionBase {
  privacyPolicy = EditUserPrivacy;
}
