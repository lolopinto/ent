import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  AccountEditInput,
  EditAccountActionBase,
} from "src/ent/account/actions/generated/edit_account_action_base";

export { AccountEditInput };

export default class EditAccountAction extends EditAccountActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
