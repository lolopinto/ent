import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { DeleteAccountActionBase } from "src/ent/account/actions/generated/delete_account_action_base";

export default class DeleteAccountAction extends DeleteAccountActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
