/**
 * Copyright whaa whaa
 */

import { EditUserAllFieldsActionBase } from "../../generated/user/actions/edit_user_all_fields_action_base.js";
import type { EditUserAllFieldsInput } from "../../generated/user/actions/edit_user_all_fields_action_base.js";
import { EditUserPrivacy } from "./edit_user_privacy.js";
export type { EditUserAllFieldsInput };
export default class EditUserAllFieldsAction extends EditUserAllFieldsActionBase {
  getPrivacyPolicy() {
    return EditUserPrivacy;
  }
}
