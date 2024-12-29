import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { DeleteAccountActionBase } from "src/ent/generated/account/actions/delete_account_action_base";

export class DeleteAccountAction extends DeleteAccountActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
