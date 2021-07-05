import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import {
  AccountCreateInput,
  CreateAccountActionBase,
} from "src/ent/account/actions/generated/create_account_action_base";

export { AccountCreateInput };

export default class CreateAccountAction extends CreateAccountActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
