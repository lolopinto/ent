import { AlwaysAllowPrivacyPolicy, IDViewer, Data } from "@snowtop/ent";
import {
  AccountCreateInput,
  CreateAccountActionBase,
} from "src/ent/generated/account/actions/create_account_action_base";

export { AccountCreateInput };

export default class CreateAccountAction extends CreateAccountActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
