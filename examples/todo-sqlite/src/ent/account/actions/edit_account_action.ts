import { AlwaysAllowPrivacyPolicy } from "@snowtop/ent";
import { EditAccountActionBase } from "src/ent/generated/account/actions/edit_account_action_base";
import type { AccountEditInput } from "src/ent/generated/account/actions/edit_account_action_base";

export type { AccountEditInput };

export class EditAccountAction extends EditAccountActionBase {
  getPrivacyPolicy() {
    return AlwaysAllowPrivacyPolicy;
  }
}
