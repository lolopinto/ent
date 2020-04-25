import {
  EditUserActionBase,
  UserEditInput,
} from "src/ent/user/actions/generated/edit_user_action_base";
import { EditUserPrivacy } from "./edit_user_privacy";

export { UserEditInput };

// we're only writing this once except with --force and packageName provided
export default class EditUserAction extends EditUserActionBase {
  privacyPolicy = EditUserPrivacy;
}
