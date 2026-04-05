/**
 * Copyright whaa whaa
 */

import { EditUserAllFieldsActionBase } from "../../generated/user/actions/edit_user_all_fields_action_base";
import type { EditUserAllFieldsInput } from "../../generated/user/actions/edit_user_all_fields_action_base";
import { EditUserPrivacy } from "./edit_user_privacy";
export type { EditUserAllFieldsInput };
export default class EditUserAllFieldsAction extends EditUserAllFieldsActionBase {
  getPrivacyPolicy() {
    return EditUserPrivacy;
  }
}
