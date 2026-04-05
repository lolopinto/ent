import { AlwaysAllowPrivacyPolicy, IDViewer, Data } from "@snowtop/ent";
import { CreateAccountActionBase } from "src/ent/generated/account/actions/create_account_action_base";
import type { AccountCreateInput } from "src/ent/generated/account/actions/create_account_action_base";

export type { AccountCreateInput };

export class CreateAccountAction extends CreateAccountActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }

  viewerForEntLoad(data: Data) {
    return new IDViewer(data.id);
  }
}
