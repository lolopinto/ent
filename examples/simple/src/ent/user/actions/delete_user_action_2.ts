/**
 * Copyright whaa whaa
 */

import { DeleteUserAction2Base } from "../../generated/user/actions/delete_user_action_2_base";
import type { DeleteUserInput2 } from "../../generated/user/actions/delete_user_action_2_base";
import { EditUserPrivacy } from "./edit_user_privacy";
export type { DeleteUserInput2 };
export default class DeleteUserAction2 extends DeleteUserAction2Base {
  getPrivacyPolicy() {
    return EditUserPrivacy;
  }
}
