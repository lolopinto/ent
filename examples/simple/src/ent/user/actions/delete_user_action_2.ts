/**
 * Copyright whaa whaa
 */

import {
  DeleteUserAction2Base,
  DeleteUserInput2,
} from "./generated/delete_user_action_2_base";
import { EditUserPrivacy } from "./edit_user_privacy";

export { DeleteUserInput2 };

export default class DeleteUserAction2 extends DeleteUserAction2Base {
  getPrivacyPolicy() {
    return EditUserPrivacy;
  }
}
