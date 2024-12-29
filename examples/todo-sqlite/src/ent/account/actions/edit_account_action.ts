import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  AccountEditInput,
  EditAccountActionBase,
} from "src/ent/generated/account/actions/edit_account_action_base";

export { AccountEditInput };

export class EditAccountAction extends EditAccountActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
